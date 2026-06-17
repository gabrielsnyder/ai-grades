# AI-Grades — Architecture Redesign

Status: **proposed** · Author: rearchitecture pass · Supersedes the implicit Indicator/Assessment design.

This document is the agreed target architecture. All teardown/refactor work should
converge on this. Decisions locked so far:

- **Full Signal → Evidence → Score model** (not an in-place patch).
- **Structured congressional vote data integrated in Phase 1** (deterministic votes,
  no Serper/LLM guessing).

---

## 1. Why we're rebuilding

Almost every recent bug traced to **one conceptual flaw**: the `Indicator` row was used
simultaneously as "a thing to look for" (a probe) *and* "a thing one candidate said" (a fact).
Because per-candidate facts lived in a globally-unique `Indicator.name`, they leaked across
candidates and required hacks (`candidateId::` prefix) to stay separated.

Symptoms this caused:

| Symptom | Root |
|---|---|
| Espaillat's statement appearing under Hamadeh | per-candidate fact stored as a global Indicator |
| `candidateId::` name-prefix hack | retrofitting "shared vs. per-candidate" onto one field |
| Duplicate H.R.7103 scored twice | same bill became two Indicators under two questions |
| Aaron Bean: 0 vote findings | votes inferred from search snippets instead of vote records |
| `UNVERIFIED` assessments invisible on public page | one field overloaded as both "scored" and "published" |
| Scores computed 3 different ways | no single rollup function |

---

## 2. The three-layer model

```
SIGNAL   (candidate-agnostic: "what to look for")
  → EVIDENCE   (per-candidate: "what we actually found")
      → QUESTION SCORE   (per-candidate × question: the scorecard cell)
```

### Layer 1 — Signal (shared, candidate-agnostic)
A probe attached to a Question. Two kinds:
- **VOTE** — references a specific `Bill`/`RollCall`; carries the *valence* ("a YES vote
  means more Booster" or "more Skeptic", plus magnitude). Applies to a chamber/cohort.
- **DISCOVERY** — an open stance probe (often just the question itself), resolved per
  candidate by web research.

Signals are curated + grown over time. They are the unit you reuse across all candidates.

### Layer 2 — Evidence (per-candidate fact)
A concrete fact about **one** candidate: a vote record, a quote, an article. Keyed by
`candidateId` — so cross-contamination is structurally impossible. Fields:
- `candidateId`, `questionId`, `signalId?`
- `type` (VOTE_RECORD | STATEMENT | CAMPAIGN_STATEMENT | ARTICLE | CUSTOM)
- `stance` (1–5 directional estimate for THIS fact)
- `confidence` (0–1)
- `sourceId`, `excerpt`
- `origin` (AGENT | HUMAN), `agentRunId`, `status` (FOUND | VERIFIED | REJECTED)

### Layer 3 — QuestionScore (the scorecard cell)
Exactly one row per `(candidate, question)` — which is exactly what the public table renders
(16 columns). Fields:
- `candidateId`, `questionId`
- `value` (1–5), `rationale`, `confidence`
- `reviewStatus` (see §5), `origin`, `rubricVersion`, `agentRunId`
- cites Evidence via `QuestionScoreEvidence` join.

`value` is produced **holistically by the LLM** ("let the intelligence be intelligent"): the
assessor reads every Evidence item for the question — each already carrying a `stance` and
`confidence` — and weighs them with judgment to emit one 1–5 score plus rationale. Evidence
*type* weights (`WeightingProfile`/`TypeWeight`) become **advisory guidance in the prompt**
("a bill vote is stronger signal than a floor remark"), not a deterministic multiplier.
Humans can override `value` + `rationale`.

---

## 3. Proposed schema (Prisma)

New/changed models. `Candidate`, `Question`, `User`, `AgentRun`, `SearchCache`,
`WeightingProfile`, `TypeWeight` stay (minor edits noted).

```prisma
// Candidate: add bioguideId for vote joins
model Candidate {
  // ...existing...
  bioguideId String?  // crosswalked from FEC id; key for roll-call joins
}

// ── Layer 1: Signals + Bill catalog ──────────────────────────────
model Signal {
  id         String      @id @default(cuid())
  questionId String
  question   Question    @relation(fields: [questionId], references: [id])
  kind       SignalKind  // VOTE | DISCOVERY
  title      String
  description String?     @db.Text
  chamber    String?     // HOUSE | SENATE | null
  // VOTE-only:
  rollCallId String?
  rollCall   RollCall?   @relation(fields: [rollCallId], references: [id])
  yesMeans   Int?        // stance (1–5) a YES vote implies; NO implies the mirror
  evidence   Evidence[]
  @@index([questionId])
}

model Bill {
  id        String     @id @default(cuid())
  congress  Int
  chamber   String     // HOUSE | SENATE
  number    String     // "hr7103", "s1234"
  title     String
  summary   String?    @db.Text
  rollCalls RollCall[]
  @@unique([congress, chamber, number])
}

model RollCall {
  id          String       @id @default(cuid())
  billId      String
  bill        Bill         @relation(fields: [billId], references: [id])
  congress    Int
  chamber     String
  number      Int          // roll number
  date        DateTime?
  question    String?      // clerk's "question" text
  memberVotes MemberVote[]
  signals     Signal[]
  @@unique([congress, chamber, number])
}

model MemberVote {
  id         String   @id @default(cuid())
  rollCallId String
  rollCall   RollCall @relation(fields: [rollCallId], references: [id])
  bioguideId String
  position   String   // YES | NO | PRESENT | NOT_VOTING
  @@unique([rollCallId, bioguideId])
  @@index([bioguideId])
}

// ── Layer 2: Evidence ────────────────────────────────────────────
model Evidence {
  id          String        @id @default(cuid())
  candidateId String
  candidate   Candidate     @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  questionId  String
  question    Question      @relation(fields: [questionId], references: [id])
  signalId    String?
  signal      Signal?       @relation(fields: [signalId], references: [id])
  type        EvidenceType
  stance      Int?          // 1–5 directional estimate for this fact
  confidence  Float
  sourceId    String?
  source      Source?       @relation(fields: [sourceId], references: [id])
  excerpt     String?       @db.Text
  origin      Origin        @default(AGENT)
  status      EvidenceStatus @default(FOUND)
  agentRunId  String?
  agentRun    AgentRun?     @relation(fields: [agentRunId], references: [id])
  scores      QuestionScoreEvidence[]
  createdAt   DateTime      @default(now())
  @@index([candidateId])
  @@index([questionId])
}

// ── Layer 3: QuestionScore ───────────────────────────────────────
model QuestionScore {
  id           String       @id @default(cuid())
  candidateId  String
  candidate    Candidate    @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  questionId   String
  question     Question     @relation(fields: [questionId], references: [id])
  value        Int?
  rationale    String?      @db.Text
  confidence   Float?
  reviewStatus ReviewStatus @default(DRAFT)
  origin       Origin       @default(AGENT)
  rubricVersion Int         @default(1)
  agentRunId   String?
  agentRun     AgentRun?    @relation(fields: [agentRunId], references: [id])
  evidence     QuestionScoreEvidence[]
  flags        Flag[]
  updatedAt    DateTime     @updatedAt
  @@unique([candidateId, questionId])
  @@index([candidateId])
}

model QuestionScoreEvidence {
  questionScoreId String
  evidenceId      String
  questionScore   QuestionScore @relation(fields: [questionScoreId], references: [id], onDelete: Cascade)
  evidence        Evidence      @relation(fields: [evidenceId], references: [id], onDelete: Cascade)
  @@id([questionScoreId, evidenceId])
}

enum SignalKind { VOTE DISCOVERY }
enum EvidenceType { VOTE_RECORD STATEMENT CAMPAIGN_STATEMENT ARTICLE CUSTOM }
enum EvidenceStatus { FOUND VERIFIED REJECTED }
// ReviewStatus: DRAFT | PUBLISHED | FLAGGED | HUMAN_REVIEWED  (see §5)
```

**Dropped/retired:** `Indicator`, `Assessment`, `AssessmentSource`. (`Correction` and
`Assessment.supersedes` were effectively unused — retire unless review finds a consumer.)

---

## 4. Pipeline redesign — two acquisition modes

### 4a. Top-down (VOTE signals) — deterministic, shared, cheap
1. Maintain a **Bill catalog** per question (curated list of AI-relevant bills + their valence).
2. For each bill, load its **RollCall + MemberVote** rows **once** from a structured source.
3. Join `MemberVote.bioguideId → Candidate.bioguideId` → create `Evidence(type=VOTE_RECORD,
   stance = signal.yesMeans or its mirror)` for every member. **No Serper, no LLM.**

This eliminates the entire "infer a vote from a search snippet" failure mode (Aaron Bean).

### 4b. Bottom-up (DISCOVERY signals) — per-candidate research
1. Researcher searches the candidate's name (as today), but is hard-scoped to
   "this candidate is the actor."
2. Output is **Evidence rows tied to a questionId**, not new global Indicators.
3. Each Evidence gets a `stance` + `confidence` from the LLM.

### 4c. Scoring — holistic per-question rollup (≤16 calls/candidate, not dozens)
For each `(candidate, question)` with evidence:
- The assessor LLM reads **all** Evidence for the question (each with its `stance` +
  `confidence`) and emits one 1–5 `value`, `confidence`, and `rationale` using judgment.
- The directional framework (skeptic↔booster) and evidence-strength guidance (votes >
  statements) live in the prompt, as in today's `SCORING_FRAMEWORK`.
- Human override replaces `value`+`rationale` and sets `HUMAN_REVIEWED`.

**Consequence:** because scoring is holistic, type weights are no longer a live client-side
multiplier. The editor's instant weight-slider recompute (`EditorWeightsView`) is retired or
reframed — changing weights changes prompt *guidance* and requires a re-score (agent run),
not an instant recalculation. The frontend's only arithmetic is averaging the 16 question
values into the Overall.

---

## 5. ReviewStatus lifecycle (un-overloaded)

Separate "is it scored" from "is it publishable":

```
DRAFT          → agent produced it; NOT shown publicly
PUBLISHED      → passed machine verification; shown publicly   (replaces MACHINE_VERIFIED/AUTO_CORRECTED)
FLAGGED        → needs human review; not shown
HUMAN_REVIEWED → human-authoritative; shown; agents may not overwrite
```

Public scorecard shows `{ PUBLISHED, HUMAN_REVIEWED }`. One constant in `lib/constants.js`,
imported everywhere (kills the scattered magic-string filters).

---

## 6. Congressional vote data source (Phase 1)

Recommendation, given our candidates are FEC-sourced:

- **Roll-call votes (authoritative, free, no key):** House Clerk vote XML
  (`clerk.house.gov/Votes`) + Senate LIS XML. These are the primary feeds everyone else
  aggregates. Alternatively consume the packaged **@unitedstates/congress** bulk vote data.
- **Bill metadata:** Congress.gov API (`api.congress.gov`, free key via api.data.gov).
- **FEC → Bioguide crosswalk (the bridge):** `@unitedstates/congress-legislators`
  (`legislators-current.yaml`) — each legislator lists both `id.fec[]` and `id.bioguide`.
  Load once, set `Candidate.bioguideId`.

Avoid ProPublica Congress API (sunset/unreliable) as a primary source.

---

## 7. Other fixes the teardown should fold in

- **Scoring on the frontend collapses** to averaging the 16 `QuestionScore.value`s into the
  Overall (one `overallScore()` used everywhere). The weighted-average-over-indicators
  machinery (`weightedScore`, `resolveWeight`) is retired with `Assessment`.
- **Auth middleware** (`middleware.js`) guarding `/editor`, `/admin`, `/api/admin/*`,
  `/api/agent/*` — currently unprotected server-side.
- **Externalize prompts** (`SCORING_FRAMEWORK`, researcher tool instructions) out of source.
- **Constants module** for `EvidenceType`, `ReviewStatus` sets, score thresholds, batch sizes.
- **Pagination** on `findMany` over candidates/assessments.
- **Shared batch runner** used by both `/api/agent/pipeline` and `/api/agent/research/batch`.

---

## 8. Migration plan (data)

1. Add new tables alongside old ones (no destructive change yet).
2. Backfill `Candidate.bioguideId` from the legislators crosswalk.
3. For each existing `Assessment`:
   - derive `candidateId` (strip any `candidateId::` prefix on the indicator),
   - create `Evidence` (type from `Indicator.type`, `stance` = `Assessment.value`,
     link its sources),
   - recompute/insert the `QuestionScore` rollup, carrying `reviewStatus`
     (`MACHINE_VERIFIED`→`PUBLISHED`, `HUMAN_REVIEWED`→`HUMAN_REVIEWED`).
4. Verify scorecard parity, then drop `Indicator`/`Assessment`/`AssessmentSource`.

---

## 9. Phases

- **P0** — land this schema + migration scaffolding; `lib/constants.js`; single scoring fn.
- **P1** — vote pipeline: legislators crosswalk → `bioguideId`; Bill catalog; roll-call loader;
  deterministic vote Evidence.
- **P2** — discovery pipeline: researcher → Evidence; assessor → per-question rollup.
- **P3** — consolidation: auth middleware, prompt externalization, pagination, shared batch runner.
- **P4** — file-by-file teardown against this doc; delete retired concepts.
