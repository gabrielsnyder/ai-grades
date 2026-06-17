-- P0: Signal → Evidence model
-- Additive migration — existing tables untouched until P4 data migration.

-- ── New enum values ───────────────────────────────────────────────────────────

ALTER TYPE "ReviewStatus"  ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "ReviewStatus"  ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "AgentRunType"  ADD VALUE IF NOT EXISTS 'VOTE_LOADER';

DO $$ BEGIN
  CREATE TYPE "EvidenceType" AS ENUM (
    'VOTE_RECORD', 'STATEMENT', 'CAMPAIGN_STATEMENT', 'ARTICLE', 'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SignalKind" AS ENUM ('VOTE', 'DISCOVERY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Candidate: add bioguideId ─────────────────────────────────────────────────

ALTER TABLE "Candidate"
  ADD COLUMN IF NOT EXISTS "bioguideId" TEXT;

CREATE INDEX IF NOT EXISTS "Candidate_bioguideId_idx" ON "Candidate"("bioguideId");

-- ── Bill catalog ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Bill" (
  "id"       TEXT NOT NULL,
  "congress" INTEGER NOT NULL,
  "chamber"  TEXT NOT NULL,
  "number"   TEXT NOT NULL,
  "title"    TEXT NOT NULL,
  "summary"  TEXT,
  CONSTRAINT "Bill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Bill_congress_chamber_number_key" UNIQUE ("congress", "chamber", "number")
);

-- ── Roll calls ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "RollCall" (
  "id"       TEXT NOT NULL,
  "billId"   TEXT NOT NULL,
  "congress" INTEGER NOT NULL,
  "chamber"  TEXT NOT NULL,
  "number"   INTEGER NOT NULL,
  "date"     TIMESTAMP(3),
  "question" TEXT,
  CONSTRAINT "RollCall_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RollCall_congress_chamber_number_key" UNIQUE ("congress", "chamber", "number"),
  CONSTRAINT "RollCall_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "RollCall_billId_idx" ON "RollCall"("billId");

-- ── Member votes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MemberVote" (
  "id"         TEXT NOT NULL,
  "rollCallId" TEXT NOT NULL,
  "bioguideId" TEXT NOT NULL,
  "position"   TEXT NOT NULL,
  CONSTRAINT "MemberVote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemberVote_rollCallId_bioguideId_key" UNIQUE ("rollCallId", "bioguideId"),
  CONSTRAINT "MemberVote_rollCallId_fkey" FOREIGN KEY ("rollCallId") REFERENCES "RollCall"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "MemberVote_bioguideId_idx" ON "MemberVote"("bioguideId");

-- ── Signals ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Signal" (
  "id"               TEXT NOT NULL,
  "questionId"       TEXT NOT NULL,
  "kind"             "SignalKind" NOT NULL,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "chamber"          TEXT,
  "appliesToGroupId" TEXT,
  "rollCallId"       TEXT,
  "yesMeans"         INTEGER,
  CONSTRAINT "Signal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Signal_questionId_fkey"       FOREIGN KEY ("questionId")       REFERENCES "Question"("id") ON DELETE RESTRICT,
  CONSTRAINT "Signal_appliesToGroupId_fkey" FOREIGN KEY ("appliesToGroupId") REFERENCES "CandidateGroup"("id") ON DELETE SET NULL,
  CONSTRAINT "Signal_rollCallId_fkey"       FOREIGN KEY ("rollCallId")       REFERENCES "RollCall"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Signal_questionId_idx" ON "Signal"("questionId");

-- ── Evidence ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Evidence" (
  "id"            TEXT NOT NULL,
  "candidateId"   TEXT NOT NULL,
  "questionId"    TEXT NOT NULL,
  "signalId"      TEXT,
  "type"          "EvidenceType" NOT NULL,
  "stance"        INTEGER,
  "confidence"    DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "rationale"     TEXT,
  "sourceId"      TEXT,
  "excerpt"       TEXT,
  "origin"        "Origin" NOT NULL DEFAULT 'AGENT',
  "reviewStatus"  "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "rubricVersion" INTEGER NOT NULL DEFAULT 1,
  "agentRunId"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Evidence_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE,
  CONSTRAINT "Evidence_questionId_fkey"  FOREIGN KEY ("questionId")  REFERENCES "Question"("id") ON DELETE RESTRICT,
  CONSTRAINT "Evidence_signalId_fkey"    FOREIGN KEY ("signalId")    REFERENCES "Signal"("id")   ON DELETE SET NULL,
  CONSTRAINT "Evidence_sourceId_fkey"    FOREIGN KEY ("sourceId")    REFERENCES "Source"("id")   ON DELETE SET NULL,
  CONSTRAINT "Evidence_agentRunId_fkey"  FOREIGN KEY ("agentRunId")  REFERENCES "AgentRun"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Evidence_candidateId_idx"          ON "Evidence"("candidateId");
CREATE INDEX IF NOT EXISTS "Evidence_questionId_idx"           ON "Evidence"("questionId");
CREATE INDEX IF NOT EXISTS "Evidence_candidateId_questionId_idx" ON "Evidence"("candidateId", "questionId");

-- ── Flag: add evidenceId ──────────────────────────────────────────────────────

ALTER TABLE "Flag"
  ADD COLUMN IF NOT EXISTS "evidenceId" TEXT;

ALTER TABLE "Flag"
  DROP CONSTRAINT IF EXISTS "Flag_evidenceId_fkey";

ALTER TABLE "Flag"
  ADD CONSTRAINT "Flag_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL;
