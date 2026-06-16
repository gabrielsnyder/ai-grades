# AI Grades — Roadmap & Build Brief

> **Audience:** a future Claude **Sonnet** coding session that will implement this in phases.
> **Status:** architecture is settled (see the decision log at the end). No agent code exists yet — the app today is a scaffold. Build in the phase order in §10. Read §11 (conventions) before touching code.
> **How to use this doc:** each phase in §10 is self-contained with a goal, the files involved, and acceptance criteria. Do one phase, verify it, then move on. Don't try to build the whole pipeline at once.

---

## 1. The vision

A public AI-policy scorecard for U.S. election candidates, backed by an editorial system that can **scale to 800+ candidates without per-record human review**. The data is gathered, scored, error-corrected, and maintained primarily by LLMs. Humans set policy (questions, rubrics, weights), work a small exception queue, and curate a gold set — they do **not** review every record.

Two faces:
- **Public scorecard** — the mobile-first read-only site that exists today, but driven by computed scores from the database.
- **Editorial backend** — editor + admin tools for weights, rubrics, indicators, candidate groups, agent runs, and the flag queue.

---

## 2. Current state (what exists today)

- **Stack:** Next.js 14 (App Router), React 18, Prisma + PostgreSQL, JWT auth (httpOnly cookie) via `jose` + `bcryptjs`, deployed on Railway (`railway.toml`, migrate-on-start).
- **Public scorecard:** mobile-first (card layout < 768px, table ≥ 768px), score chips open a bottom-sheet modal on mobile / popup on desktop. Files: `app/page.jsx`, `components/Scorecard.jsx`, `ScoreChip.jsx`, `ScoreModal.jsx`, `app/globals.css`.
- **Backend scaffold:** `/login`, `/editor` (candidate list + per-candidate component editor), `/admin` (questions, groups, users tabs). API routes under `app/api/**`. Middleware guards `/editor` and `/admin`.
- **Current schema:** `Candidate`, `CandidateGroup`, `Question`, `Score`, `ScoreComponent` (typed + weighted), `User`. Seeded with 20 senators × 5 questions.
- **IMPORTANT:** the seeded data is a **one-shot, unvetted gather**. It is disposable. Nothing is "approved." Treat all existing data as `UNVERIFIED`. Do not build careful migration/backfill logic to preserve it.

---

## 3. Non-negotiable principles

These drive every schema and code decision. If a change violates one of these, stop and reconsider.

1. **Provenance pipeline.** Every derived value records what produced it (`agentRunId`), what it was derived from (sources), and what rubric version it was scored against. Everything is auditable and re-runnable.
2. **Machine-in-the-loop, not human gate.** A separate LLM (the **Verifier**) is the QA layer. It auto-corrects what it's confident about and **flags only the uncertain remainder** for humans. Default published state is *machine-verified*, not *human-approved*.
3. **Re-runs never clobber a human edit.** Agents only write/overwrite non-human states. The small `HUMAN_REVIEWED` set is immutable to agents. This makes full-pipeline re-runs safe.
4. **Weights are separable from scores.** The Assessor writes a raw 1–5 once. Weights live on indicators/profiles and are applied **only at rollup time**. Changing a weight recomputes every public score instantly — zero agent calls, zero re-runs. Only a *rubric* change forces a re-score.
5. **One SDK, provider = config.** All LLM calls go through `@anthropic-ai/sdk`. MiniMax speaks the Anthropic-compatible API, so providers differ only by `baseURL` + `apiKey` + `model`. Caching, tool use, streaming code is identical.
6. **Cost levers, not model downgrades.** Scale economically via prompt caching, the Batches API, and a cheap→strong cascade — not by reaching for a weaker model on judgment-critical steps.

---

## 4. Target architecture

```
                 ┌──────────────┐
  FEC/Ballotpedia │   Finder     │  authoritative roster + LLM normalization
        API ─────▶│  (agent)     │──▶ Candidate rows
                 └──────────────┘
                 ┌──────────────┐
  Serper search  │  Researcher  │  search → fetch → extract primary sources
        API ─────▶│  (agent)     │──▶ Source rows (FOUND)
                 └──────────────┘
                 ┌──────────────┐
                 │  Assessor    │  score each (candidate × indicator) vs rubric
                 │  (agent)     │──▶ Assessment rows (UNVERIFIED), cites Sources
                 └──────────────┘
                 ┌──────────────┐
                 │  Verifier    │  fresh-context QA: correctness + consistency
                 │  (agent)     │      + metadata + confidence
                 └──────┬───────┘
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
  MACHINE_VERIFIED  AUTO_CORRECTED     FLAGGED ──▶ small human flag queue
        └───────────────┴───────► published scorecard (weighted rollup)
```

**Search is decoupled from the LLM.** Anthropic's bundled web-search tool only runs inside a Claude call and costs $10/1k searches; MiniMax can't use it at all. So the Researcher uses **Serper** ($0.30–$1.00/1k) for raw results, optionally a cheap MiniMax pass to compress/filter results, then feeds the model. This makes search provider-agnostic and ~10–30× cheaper on search fees.

**The Researcher maintains a research library (SearchCache) before calling Serper.** All Serper results are saved to `SearchCache` at query time. On subsequent Researcher runs — whether for the same candidate or a different one asking about the same topic — the Researcher queries the library first. A cache hit reuses the stored payload and skips the Serper call entirely. As the corpus grows to 800+ candidates, the proportion of Serper calls that can be satisfied from the library grows too. The cache is the primary cost lever for search at scale.

---

## 5. Target data model

Express in `prisma/schema.prisma`. This **supersedes** today's `Score`/`ScoreComponent`. Names are guidance; keep them unless you have a strong reason.

### Keep / evolve
- `Candidate` — add nothing required beyond existing (`name`, `state`, `party`, `groupId`). Eventually add `office`, `electionYear`, `externalId` (FEC/Ballotpedia id) for the Finder.
- `CandidateGroup` — unchanged.
- `Question` — the 5 top-level scorecard dimensions. Unchanged (`text`, `description`, `order`).
- `User` — unchanged (`ADMIN` | `EDITOR`).

### New / changed

**`Indicator`** — reusable *definition* of one measurable input belonging to a Question. This is the layer missing today.
```
Indicator {
  id, questionId
  name                 // "Vote bundle: 2025–26 frontier-safety bills"
  type                 // IndicatorType enum
  rubric        Text   // scoring criteria handed to the Assessor
  rubricVersion Int     // bump on rubric change → triggers re-score
  weight        Float?  // optional override of the type default
  appliesToGroupId?     // null = global; else scoped to a candidate group
}
enum IndicatorType { BILL_VOTE PUBLIC_STATEMENT CAMPAIGN_STATEMENT CUSTOM }
```

**`WeightingProfile`** + **`TypeWeight`** — named weight schemes (for the admin "apply to groups" requirement).
```
WeightingProfile { id, name, isActive Bool }
TypeWeight { id, profileId, type IndicatorType, weight Float }  // e.g. BILL_VOTE→1.5
```
Weight resolution for an assessment, most-specific wins:
`per-candidate override (rare) → Indicator.weight → active profile's TypeWeight[type]`.

**`Assessment`** — supersedes `ScoreComponent`. One per (Candidate × Indicator).
```
Assessment {
  id, candidateId, indicatorId
  value Int           // raw 1–5, written once by the Assessor
  rationale Text
  weightOverride Float?
  reviewStatus        // UNVERIFIED | MACHINE_VERIFIED | AUTO_CORRECTED | FLAGGED | HUMAN_REVIEWED
  origin              // AGENT | HUMAN
  agentRunId?         // producer
  rubricVersion Int   // version it was scored against
  supersedesId?       // links a re-score to the prior Assessment (audit)
  @@unique([candidateId, indicatorId])   // current head; history via supersedesId chain
}
```

**`Source`** — raw evidence, decoupled from judgment.
```
Source { id, candidateId, url, title, excerpt Text, publishedAt?, status (FOUND|VERIFIED|REJECTED), agentRunId? }
AssessmentSource { assessmentId, sourceId }   // many-to-many
```

**`SearchCache`** — the research library. All Serper results are saved here; the Researcher queries this before calling Serper.
```
SearchCache {
  id
  query           String   // raw query string as sent to Serper
  normalizedQuery String   // lowercased, trimmed, de-duped token form for fast lookup
  results         Json     // full Serper response payload
  resultCount     Int
  source          String   @default("SERPER")
  fetchedAt       DateTime @default(now())
  expiresAt       DateTime?  // optional TTL; null = never expire
  hitCount        Int      @default(0)   // incremented on each cache hit
  candidateId?             // tagged at search time for traceability
  indicatorId?
  @@index([normalizedQuery])
}
```
Query strategy: exact match on `normalizedQuery` first, then optional fuzzy/prefix match for near-duplicate queries. Expiry is per-entry; a rubric change or known election date can trigger selective expiry without clearing the whole cache.

**`AgentRun`** — provenance + re-run control.
```
AgentRun {
  id, type (CANDIDATE_FINDER|RESEARCHER|ASSESSOR|VERIFIER)
  status (QUEUED|RUNNING|DONE|FAILED)
  scope Json          // { candidateIds?, indicatorIds?, groupId? }
  provider, model     // which LLM produced this run
  dryRun Bool
  costInputTokens, costOutputTokens
  searchCount         Int   // Serper calls actually fired (cache hits not counted)
  cacheHitCount       Int   // SearchCache hits that saved a Serper call
  error?, startedAt?, finishedAt?, createdAt
}
```

**`Correction`** + **`Flag`** — Verifier output.
```
Correction { id, agentRunId, assessmentId?, sourceId?, check, field, before, after, confidence Float }
Flag       { id, agentRunId, targetType, targetId, reason, severity, confidence Float, status (OPEN|RESOLVED) }
```

### reviewStatus ladder & published rule
```
UNVERIFIED ──(Verifier)──▶ MACHINE_VERIFIED | AUTO_CORRECTED | FLAGGED ──(human)──▶ HUMAN_REVIEWED
```
- **Published set** = `MACHINE_VERIFIED ∪ AUTO_CORRECTED ∪ HUMAN_REVIEWED`. `FLAGGED` is held back (or shown with a caveat — see open questions).
- **Agents may write** `UNVERIFIED`/`MACHINE_VERIFIED`/`AUTO_CORRECTED`/`FLAGGED`. Agents must **never** modify `HUMAN_REVIEWED` rows.

### Rollup rule (single source of truth in `lib/scoring`)
- Question score = `Σ(value_i × w_i) / Σ(w_i)` over **published** assessments `i` for that candidate+question.
- Unanswered indicators are excluded from numerator and denominator (same null-handling as today).
- Overall = average of non-null question scores. Keep existing label/color bands.

---

## 6. The agents

Each agent is an `AgentRun` type, executed by the worker (§8). For each: input → output, Claude surface, model.

| Agent | Input | Output | Surface | Default model |
|---|---|---|---|---|
| **Finder** | office, year, state filter; FEC/Ballotpedia API | `Candidate` rows | Authoritative API + 1 LLM call for name normalization/dedupe | MiniMax |
| **Researcher** | candidate × indicator | `Source` rows (FOUND) | **Check `SearchCache` first**; cache miss → Serper → save to cache; fetch + extract; optional MiniMax compress pass | MiniMax |
| **Assessor** | candidate × indicator + its sources + rubric | `Assessment` (UNVERIFIED) | **Single call, structured output**; cache the rubric prefix; Batches for bulk | Sonnet 4.6 |
| **Verifier** | an Assessment + its sources | `Correction`/`Flag` + status transition | **Single fresh-context call, structured output**; deterministic checks first | MiniMax screen → Sonnet on flagged |

### Agent design notes
- **Researcher: cache-first, Serper second.** Before any Serper call, the Researcher normalizes the query (`normalizedQuery`) and looks up `SearchCache`. A hit reuses the stored payload (increment `hitCount`), skips the Serper call, and tags the entry with `candidateId`/`indicatorId` if not already set. A miss calls Serper, saves the full response to `SearchCache`, then proceeds to fetch + extract. Log `searchCount` and `cacheHitCount` on `AgentRun` so the admin dashboard can show cache efficiency over time.
- **Finder: API is ground truth, LLM only normalizes.** Never let the LLM *enumerate* candidates — hallucination/omission is a credibility risk. Pull the roster from FEC OpenFEC or Ballotpedia; use one LLM call to fuzzy-match names and dedupe.
- **Assessor:** one structured-output call per (candidate × indicator) returning `{ value: 1–5, rationale, confidence, citedSourceIds }`. Cache the rubric + instructions (stable prefix); vary only the candidate/source suffix. Submit via the **Batches API** when re-scoring in bulk (not latency-sensitive).
- **Verifier (the QA centerpiece):**
  1. **Deterministic validators first** (pure code, no LLM): value ∈ 1–5, no dangling/duplicate source, party/state consistent, source date in window. Cheap and reliable.
  2. **One fat LLM call** for judgment + metadata, returning structured per-check verdicts: right candidate? bill/ID real? source is *primary*? **does the cited source actually support the claim?** (highest-value check) + normalized name, extracted bill IDs, source-type classification + **overall confidence**.
  3. **Verdict → action:** high confidence pass → `MACHINE_VERIFIED`; high-confidence fix → write `Correction`, set `AUTO_CORRECTED`; low confidence → `Flag`, set `FLAGGED`.
  4. **Fresh context, not self-critique** — the Verifier is a separate run from the Assessor; a fresh-context verifier catches far more than asking the Assessor to check itself.

---

## 7. Model & provider strategy

- **One client per provider**, both `@anthropic-ai/sdk`, selected by `AgentRun.provider`:
  ```
  providers = {
    minimax: { baseURL: <MiniMax Anthropic-compatible endpoint>, apiKey: MINIMAX_API_KEY, model: "MiniMax-M2.7" },
    claude:  { baseURL: default,                                  apiKey: ANTHROPIC_API_KEY, model: "claude-sonnet-4-6" },
  }
  ```
- **Claude default = `claude-sonnet-4-6`.** Opus 4.8 (`claude-opus-4-8`) is an escalation lever only — not the default.
- **MiniMax** (`MiniMax-M2.7`, ~$0.30/$1.20 per M tokens) for bulk extraction, Finder normalization, and the Verifier first pass. Confirm exact base URL + model id at build time.
- **The cascade:** MiniMax screens the whole corpus → Sonnet re-checks only the flagged/low-confidence slice (~10–20%) → Opus only if a check class proves too hard for Sonnet. Both layers cache prefixes.
- **Caching:** use `cache_control: { type: "ephemeral" }` on the stable rubric/check-list prefix. Caches are per provider+model (expected). Min cacheable prefix is ~2048 tokens on Sonnet 4.6 — short prefixes silently won't cache.
- **Feature-parity to verify on MiniMax's endpoint** (these are Anthropic-*platform* features, not Messages API): **Batches API** and **`output_config.format` structured outputs**. If MiniMax lacks either: fall back to **tool-use-with-a-schema** for structured output (portable across any Anthropic-compatible endpoint) and per-request submission instead of batch. Caching, messages, and tool use are confirmed on both.
- **Cost reference (per 1M tokens):** MiniMax M2.7 $0.30/$1.20 · Sonnet 4.6 $3/$15 · Opus 4.8 $5/$25. Search: Serper $0.30–$1.00/1k vs Anthropic web search $10/1k.

---

## 8. Orchestration (Railway worker + Postgres queue)

- **One new Railway service**: a worker process. **Postgres-backed queue** (`graphile-worker` — reuses the existing DB, no Redis).
- **Flow:** admin triggers a run → API inserts `AgentRun` (QUEUED) → worker claims it → runs the agent → writes `Source`/`Assessment`/`Correction`/`Flag` rows → marks DONE with token/search cost.
- **Dry-run mode:** `AgentRun.dryRun = true` computes the diff ("would change 14 scores, add 31 sources") **without writing**. Required before any bulk re-score.
- **Scoped re-runs:** `AgentRun.scope` filters by candidate/indicator/group. "Re-verify Q2 across this group" is one scoped run. Idempotent: re-runs replace prior agent-written rows (via `supersedesId`), never touch `HUMAN_REVIEWED`.
- Long LLM work never blocks a web request — it's all in the worker.

---

## 9. Human surfaces (small by design)

- **Flag/exception queue** — the only per-record human surface. Lists `FLAGGED` items, sized to real capacity. Actions: confirm → `HUMAN_REVIEWED`; correct → edit value/rationale, `HUMAN_REVIEWED`; reject. This is the *shrunken* version of a review queue.
- **Weight sliders (live preview)** — editor adjusts `TypeWeight`s and per-indicator weights; the scorecard recomputes **in real time** (pure arithmetic on stored scores) before saving. Saving persists weights; no pipeline run.
- **Admin** — manage Questions, Indicators (+ rubrics, bump `rubricVersion`), Weighting Profiles, Candidate Groups, and **Agent Runs** (trigger scoped/dry-run runs, watch status/cost). Plus a **Gold Set** manager.
- **Gold set + eval harness (the trust mechanism that replaces per-record review).** Hand-grade ~50–100 records once, seed known error types, measure the Verifier's precision/recall, and calibrate the auto-correct-vs-flag confidence thresholds. Human time goes to: gold set, flag queue, random-sample audits — not reviewing everything.

---

## 10. Build sequence (do in order)

Each phase has acceptance criteria. Verify before moving on. **Phases 1–3 are identical regardless of agents and unblock everything — start there.**

### Phase 0 — Prep
- Read §11 conventions. Confirm `npm install`, `npx prisma generate`, `npm run build` succeed on the branch.
- **Done when:** clean build on the branch.

### Phase 1 — Schema migration + reseed
- Replace `Score`/`ScoreComponent` with the §5 model (`Indicator`, `Assessment`, `Source`, `AssessmentSource`, `AgentRun`, `Correction`, `Flag`, `WeightingProfile`, `TypeWeight`).
- Reseed the 20 senators as `Indicator`s (type `CUSTOM`) + `Assessment`s at `reviewStatus = UNVERIFIED`, `origin = AGENT`. No careful migration — drop and reseed.
- Seed a default `WeightingProfile` with sensible `TypeWeight`s (BILL_VOTE 1.5, PUBLIC_STATEMENT 1.0, CAMPAIGN_STATEMENT 0.5, CUSTOM 1.0).
- **Done when:** `prisma migrate` + seed run clean; `lib/scoring` rollup computes question/overall scores from `Assessment` + resolved weights.

### Phase 2 — Wire the public scorecard to computed scores + live weights
- Point `app/page.jsx` / `Scorecard.jsx` at the new rollup. Public page shows only the **published set**.
- Build the **weight-slider live preview** in the editor (recompute client-side or via a cheap recompute endpoint; persist on save).
- **Done when:** changing a weight visibly re-sorts the scorecard with no agent call; public page renders from DB.

### Phase 3 — Flag/exception queue
- `/editor` flag queue listing `FLAGGED` assessments with confirm/correct/reject → `HUMAN_REVIEWED`. Show the assessment, its sources, and the Verifier's flag reason.
- **Done when:** a human can resolve a flagged item and it leaves the queue + enters the published set.

### Phase 4 — Provider abstraction + Assessor
- `lib/llm` provider registry (§7). One `@anthropic-ai/sdk` client per provider.
- Assessor: structured-output scoring call (or tool-use-schema fallback), rubric prefix cached. Wire it as an `AgentRun` the worker can execute (worker can come in Phase 4 or be stubbed as a direct call first).
- **Done when:** an Assessor run scores a candidate×indicator from real sources and writes an `UNVERIFIED` `Assessment` with provenance.

### Phase 5 — Verifier + cascade
- Deterministic validators (code) + the fat structured Verifier call. Status transitions + `Correction`/`Flag` writes. MiniMax screen → Sonnet on flagged.
- **Done when:** a Verifier run moves `UNVERIFIED` → verified/corrected/flagged with correct provenance, and never touches `HUMAN_REVIEWED`.

### Phase 6 — Worker + queue + dry-run
- `graphile-worker` service; `AgentRun` lifecycle; scoped runs; dry-run diff UI in admin.
- **Done when:** admin triggers a scoped dry-run, sees the diff, then commits it.

### Phase 7 — Researcher + Serper + research library
- Serper client; `SearchCache` table (from Phase 1 schema); cache-first lookup; cache miss → Serper call → save to library; fetch → extract `Source` rows; optional MiniMax compression.
- **Done when:**
  - A Researcher run populates `Source`s with URLs + excerpts for a candidate×indicator.
  - Running the same Researcher twice fires Serper only once; the second run is a cache hit (`hitCount` increments, `cacheHitCount` on `AgentRun` > 0).
  - Admin can see `searchCount` vs `cacheHitCount` per `AgentRun`.
  - Cache entries have `fetchedAt`; expired entries (`expiresAt < now()`) are treated as misses.

### Phase 8 — Finder
- FEC/Ballotpedia ingest + LLM name-normalization → `Candidate` rows (`office`, `electionYear`, `externalId`).
- **Done when:** a Finder run ingests a race's roster without hallucinated/duplicate candidates.

### Phase 9 — Gold set + eval harness
- Gold-set storage + a script that measures Verifier precision/recall on seeded errors and reports threshold calibration.
- **Done when:** running the harness prints precision/recall and a suggested confidence threshold.

---

## 11. Conventions & guardrails for the coding session

### Two guiding principles

> **"Let the intelligence be intelligent."**
> Trust the LLMs to do judgment work — scoring, verification, normalization, confidence estimation. Don't over-engineer prompt guardrails or re-implement judgment in code. Write clear rubrics, give the model good context, and let it run. When in doubt, add a better prompt, not more code.

> **"In code and databases we trust."**
> The pipeline's *reliability* lives in code and schema. Deterministic validators run before the fat LLM call. `reviewStatus` is enforced by DB constraints and agent rules, not by hoping the model behaves. Rollup math lives in `lib/scoring` and nowhere else. `AgentRun`s are idempotent and scoped. `SearchCache` makes search reproducible and auditable. The LLM's output is a *row in a table* — provisional until code validates and commits it.

These two work together: give the LLM room to be smart, then pin the results down in durable, queryable, re-runnable structure.

- **Branch:** develop on `claude/mobile-scorecard-webapp-i587qz`. Commit per phase with clear messages. Push when a phase is green.
- **Stack discipline:** Next.js App Router (server components for data fetch, `'use client'` only where needed). Keep the mobile-first CSS approach in `app/globals.css` (card < 768px, table ≥ 768px). Match existing file style and naming.
- **Server pages that hit the DB** need `export const dynamic = 'force-dynamic'` (the build prerenders otherwise — this already bit us once).
- **Secrets:** never commit keys. Add `MINIMAX_API_KEY`, `SERPER_API_KEY`, `ANTHROPIC_API_KEY` to `.env.example` (placeholders) and read from env. Railway provides them at deploy.
- **LLM calls:** all through `lib/llm` (single `@anthropic-ai/sdk`, provider by config). Always parse tool/JSON output with `JSON.parse` — never regex model prose. Cache stable prefixes. Use Batches for bulk, non-latency-sensitive work where the endpoint supports it.
- **Don't break the public page** at any phase — it must always render from whatever's published.
- **Don't build human-review-at-scale UI.** The flag queue is intentionally small; the system is machine-maintained.
- **Keep `lib/scoring` the single source of truth** for rollup + weight resolution. No score math anywhere else.
- **Migrations, not `db push`,** for schema changes that ship.
- **Run before pushing:** `npx prisma generate && npm run build`.

---

## 12. Open questions (decide when reached, don't block)

- Exact MiniMax Anthropic-compatible **base URL + model id** — confirm at Phase 4.
- **Finder source:** FEC OpenFEC vs Ballotpedia (or both) — decide at Phase 8.
- **`FLAGGED` publish policy:** held back entirely vs shown with a "needs review" caveat — product call.
- **Rubric authoring format:** plain markdown vs structured criteria — affects Assessor/Verifier prompt design.
- Whether to **version `WeightingProfile`** for historical score reproducibility (nice-to-have).
- Does MiniMax's endpoint support **Batches** and **`output_config.format`** — verify at Phase 4; use tool-use-schema fallback if not.

---

## 13. Decision log (settled — don't relitigate without reason)

- **Framework:** Next.js on Railway, Postgres + Prisma. (Migrated from the old Vite SPA.)
- **Scale assumption:** 800+ candidates, **machine-maintained**, no per-record human review.
- **QA model:** machine-in-the-loop. Verifier agent auto-corrects + flags; humans handle exceptions + gold set.
- **Weights:** separable from scores, applied at rollup; live re-weighting with no re-run.
- **Search:** decoupled via **Serper** (not Anthropic's bundled web search); MiniMax filter pass optional. All Serper results saved to `SearchCache`; Researcher checks the library first before firing new Serper calls.
- **Providers:** single `@anthropic-ai/sdk`; **MiniMax** (Anthropic-compatible, caching on) for bulk; **Claude Sonnet 4.6** default, **Opus 4.8** escalation only.
- **Cost levers:** prompt caching + Batches API + cheap→strong cascade.
- **Orchestration:** Railway worker + `graphile-worker` Postgres queue; scoped, idempotent, dry-runnable `AgentRun`s.

---

## 14. Glossary

- **Indicator** — a reusable definition of one measurable input (a vote bundle, a statement topic) belonging to a Question.
- **Assessment** — one candidate's raw 1–5 score for one indicator, with provenance and review status.
- **Source** — a piece of raw evidence (URL + excerpt), many-to-many with assessments.
- **AgentRun** — one execution of an agent over a scope; the unit of provenance and re-run.
- **Verifier** — the LLM QA agent (a.k.a. the "Editor agent"; named Verifier to avoid colliding with the human *editor* backend).
- **Weighting Profile** — a named set of weights applied across a candidate group.
- **Published set** — assessments visible on the public scorecard (`MACHINE_VERIFIED ∪ AUTO_CORRECTED ∪ HUMAN_REVIEWED`).
- **Cascade** — cheap model screens everything, strong model re-checks only the uncertain slice.
- **SearchCache / Research library** — a DB table that stores every Serper result payload. The Researcher queries it (by normalized query string) before calling Serper; a hit skips the paid call. Grows more valuable as candidate count scales — later runs on similar topics hit the library at high rates.
