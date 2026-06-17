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
  → EVIDENCE   (per-candidate scored fact: "what we found", with an LLM/vote stance)
      → GRADES   (computed deterministically in code: question grade + overall grade)
```

The split of responsibility is deliberate:
- **Intelligence scores the items** — each Evidence stance is the LLM's judgment (or a
  deterministic vote mapping). "Let the intelligence be intelligent."
- **Code computes the grades** — question and overall grades are reproducible weighted
  rollups of those item stances, never an LLM guess. "In databases and code we trust."

### Layer 1 — Signal (shared, candidate-agnostic)
A probe attached to a Question. Two kinds:
- **VOTE** — references a specific `Bill`/`RollCall`; carries the *valence* ("a YES vote
  means more Booster" or "more Skeptic", plus magnitude). Applies to a chamber/cohort.
- **DISCOVERY** — an open stance probe (often just the question itself), resolved per
  candidate by web research.

Signals are curated + grown over time. They are the unit you reuse across all candidates.

### Layer 2 — Evidence (per-candidate scored fact)
A concrete fact about **one** candidate: a vote record, a quote, an article. Keyed by
`candidateId` — so cross-contamination is structurally impossible. **This is the atomic
scored unit and the unit of human review.** Fields:
- `candidateId`, `questionId`, `signalId?`
- `type` (VOTE_RECORD | STATEMENT | CAMPAIGN_STATEMENT | ARTICLE | CUSTOM)
- `stance` (1–5 directional estimate for THIS fact) ← see scoring below
- `confidence` (0–1), `rationale` (why this item got this stance)
- `sourceId`, `excerpt`
- `origin` (AGENT | HUMAN), `agentRunId`, `reviewStatus` (see §5)

**How `stance` is set — "let the intelligence be intelligent" applies HERE, at the item:**
- **VOTE_RECORD** → deterministic. `stance` = the signal's `yesMeans` (or its mirror for a
  NO vote). No LLM; the vote record + the bill's valence fully determine it.
- **STATEMENT / ARTICLE / CUSTOM** → the LLM scores the single item's directional stance
  (1–5) with judgment, plus a one-line rationale. One item at a time, in isolation.

### Layer 3 — Grades (computed, not stored) — "in databases and code we trust"
There is **no QuestionScore table.** The per-question grade and the overall grade are
**deterministic functions of the Evidence**, computed on read in `lib/scoring.js`:
- **Question grade** `(candidate, question)` = weighted average of the `stance` of that
  question's publishable Evidence, weighted by `EvidenceType` via the active
  `WeightingProfile` / `TypeWeight` (votes outweigh statements, etc.).
- **Overall grade** `(candidate)` = average of the candidate's question grades.

Because the grade is a pure, reproducible function of the underlying facts, it can never
drift out of sync, the editor's live weight-slider recompute stays meaningful, and a human
corrects a grade by correcting the **Evidence** (fix a stance, reject a bad fact, add a
HUMAN-origin item) — the grade follows automatically. An optional explicit per-question
override can be added later if ever needed; it is not part of this design.

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

// ── Layer 2: Evidence (atomic scored unit + unit of review) ──────
model Evidence {
  id           String       @id @default(cuid())
  candidateId  String
  candidate    Candidate    @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  questionId   String
  question     Question     @relation(fields: [questionId], references: [id])
  signalId     String?
  signal       Signal?      @relation(fields: [signalId], references: [id])
  type         EvidenceType
  stance       Int?         // 1–5 directional estimate for THIS fact (LLM, or deterministic for votes)
  confidence   Float
  rationale    String?      @db.Text   // why this item got this stance
  sourceId     String?
  source       Source?      @relation(fields: [sourceId], references: [id])
  excerpt      String?      @db.Text
  origin       Origin       @default(AGENT)
  reviewStatus ReviewStatus @default(DRAFT) // publishability of this fact (see §5)
  rubricVersion Int         @default(1)
  agentRunId   String?
  agentRun     AgentRun?    @relation(fields: [agentRunId], references: [id])
  flags        Flag[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  @@index([candidateId])
  @@index([questionId])
}

// ── Layer 3: Grades are COMPUTED, not stored ─────────────────────
// No QuestionScore table. Question grade = weighted avg of a question's publishable
// Evidence stances (weights by EvidenceType via the active WeightingProfile/TypeWeight);
// overall = avg of question grades. Both live in lib/scoring.js, computed on read.

enum SignalKind { VOTE DISCOVERY }
enum EvidenceType { VOTE_RECORD STATEMENT CAMPAIGN_STATEMENT ARTICLE CUSTOM }
// ReviewStatus: DRAFT | PUBLISHED | FLAGGED | HUMAN_REVIEWED  (see §5)
```

**Dropped/retired:** `Indicator`, `Assessment`, `AssessmentSource`. (`Correction` and
`Assessment.supersedes` were effectively unused — retire unless review finds a consumer.)
`Flag` re-targets from `Assessment` to `Evidence`. `Source.status` (FOUND/VERIFIED/REJECTED)
is subsumed by `Evidence.reviewStatus`; keep `Source` as the raw URL/excerpt record only.

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
3. The LLM scores each Evidence item's `stance` + `confidence` + one-line `rationale`,
   one item at a time ("let the intelligence be intelligent" — at the item level).

### 4c. Grading — deterministic rollup in code ("in databases and code we trust")
No LLM is involved in the aggregate. In `lib/scoring.js`, computed on read:
- **Question grade** `(candidate, question)` = weighted average of that question's publishable
  Evidence `stance`, weighted by `EvidenceType` via the active `WeightingProfile`/`TypeWeight`.
- **Overall grade** `(candidate)` = average of the candidate's question grades.

Because weights are real multipliers again, the editor's **live weight-slider recompute stays
meaningful** (client-side, instant). A human changes a grade by changing the **Evidence**
(adjust a stance, reject a fact, add a HUMAN-origin item); the grade recomputes deterministically.

---

## 5. ReviewStatus lifecycle (un-overloaded)

`reviewStatus` now lives on **Evidence** (the fact), separating "is it scored" from
"is it publishable":

```
DRAFT          → agent produced it; NOT counted in public grades
PUBLISHED      → passed machine verification; counted publicly   (replaces MACHINE_VERIFIED/AUTO_CORRECTED)
FLAGGED        → needs human review; not counted
HUMAN_REVIEWED → human-authoritative; counted; agents may not overwrite
```

The public grade computation includes only Evidence in `{ PUBLISHED, HUMAN_REVIEWED }`.
One constant set in `lib/constants.js`, imported everywhere (kills the scattered
magic-string filters). A question cell shows "No data" when it has no publishable Evidence.

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

- **One grading module** in `lib/scoring.js`: `questionGrade(evidence, typeWeights)` (weighted
  avg of publishable Evidence stances) and `overallGrade(questionGrades)`. The existing
  `weightedScore`/`resolveWeight` adapt to operate over Evidence instead of Assessments;
  used identically by `app/page.jsx`, `app/editor/page.jsx`, and `EditorWeightsView`
  (live recompute preserved).
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
3. For each existing `Assessment`, create one `Evidence`:
   - `candidateId` = the assessment's candidate (strip any `candidateId::` indicator prefix),
   - `questionId` = the indicator's question,
   - `type`: `BILL_VOTE`→`VOTE_RECORD`, `PUBLIC_STATEMENT`→`STATEMENT`, else map across,
   - `stance` = `Assessment.value`, `rationale` = `Assessment.rationale`, link its source(s),
   - `reviewStatus`: `MACHINE_VERIFIED`/`AUTO_CORRECTED`→`PUBLISHED`,
     `HUMAN_REVIEWED`→`HUMAN_REVIEWED`, `UNVERIFIED`→`DRAFT`, `FLAGGED`→`FLAGGED`.
   Grades are computed on read, so there is nothing else to backfill.
4. Verify scorecard parity (grades computed from migrated Evidence match the old table),
   then drop `Indicator`/`Assessment`/`AssessmentSource`.

---

## 9. Phases

- **P0** — land this schema + migration scaffolding; `lib/constants.js`; single scoring fn.
- **P1** — vote pipeline: legislators crosswalk → `bioguideId`; Bill catalog; roll-call loader;
  deterministic vote Evidence.
- **P2** — discovery pipeline: researcher → Evidence; assessor → per-question rollup.
- **P3** — consolidation: auth middleware, prompt externalization, pagination, shared batch runner.
- **P4** — file-by-file teardown against this doc; delete retired concepts.
