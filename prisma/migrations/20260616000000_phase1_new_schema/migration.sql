-- Complete from-scratch migration for Phase 1 pipeline schema.
-- Safe to run on a fresh DB or one that had db push previously.

-- ─── Drop legacy tables ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS "ScoreComponent" CASCADE;
DROP TABLE IF EXISTS "Score"          CASCADE;
DROP TYPE  IF EXISTS "ComponentType";

-- ─── Enums (idempotent) ──────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "IndicatorType"   AS ENUM ('BILL_VOTE','PUBLIC_STATEMENT','CAMPAIGN_STATEMENT','CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReviewStatus"    AS ENUM ('UNVERIFIED','MACHINE_VERIFIED','AUTO_CORRECTED','FLAGGED','HUMAN_REVIEWED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Origin"          AS ENUM ('AGENT','HUMAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AgentRunType"    AS ENUM ('CANDIDATE_FINDER','RESEARCHER','ASSESSOR','VERIFIER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AgentRunStatus"  AS ENUM ('QUEUED','RUNNING','DONE','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SourceStatus"    AS ENUM ('FOUND','VERIFIED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FlagStatus"      AS ENUM ('OPEN','RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "UserRole"        AS ENUM ('ADMIN','EDITOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Base tables (CREATE IF NOT EXISTS) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CandidateGroup" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "CandidateGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Candidate" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "state"        TEXT NOT NULL,
    "party"        TEXT NOT NULL,
    "groupId"      TEXT,
    "office"       TEXT,
    "electionYear" INTEGER,
    "externalId"   TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Candidate_groupId_idx" ON "Candidate"("groupId");

-- If Candidate already existed (from db push) it may be missing the new columns
DO $$ BEGIN ALTER TABLE "Candidate" ADD COLUMN "office"       TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Candidate" ADD COLUMN "electionYear" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Candidate" ADD COLUMN "externalId"   TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Candidate" ADD COLUMN "groupId"      TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Question" (
    "id"          TEXT NOT NULL,
    "text"        TEXT NOT NULL,
    "description" TEXT,
    "shortLabel"  TEXT,
    "order"       INTEGER NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Question_order_idx" ON "Question"("order");

CREATE TABLE IF NOT EXISTS "User" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role"         "UserRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- ─── FK: Candidate → CandidateGroup ─────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "CandidateGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Pipeline tables ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Indicator" (
    "id"               TEXT NOT NULL,
    "questionId"       TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "type"             "IndicatorType" NOT NULL,
    "rubric"           TEXT NOT NULL,
    "rubricVersion"    INTEGER NOT NULL DEFAULT 1,
    "weight"           DOUBLE PRECISION,
    "appliesToGroupId" TEXT,
    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Indicator_questionId_idx" ON "Indicator"("questionId");

DO $$ BEGIN
    ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_questionId_fkey"
        FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_appliesToGroupId_fkey"
        FOREIGN KEY ("appliesToGroupId") REFERENCES "CandidateGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WeightingProfile" (
    "id"       TEXT NOT NULL,
    "name"     TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WeightingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TypeWeight" (
    "id"        TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type"      "IndicatorType" NOT NULL,
    "weight"    DOUBLE PRECISION NOT NULL,
    CONSTRAINT "TypeWeight_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TypeWeight_profileId_type_key" ON "TypeWeight"("profileId", "type");
DO $$ BEGIN
    ALTER TABLE "TypeWeight" ADD CONSTRAINT "TypeWeight_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "WeightingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AgentRun" (
    "id"               TEXT NOT NULL,
    "type"             "AgentRunType" NOT NULL,
    "status"           "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "scope"            JSONB,
    "provider"         TEXT,
    "model"            TEXT,
    "dryRun"           BOOLEAN NOT NULL DEFAULT false,
    "costInputTokens"  INTEGER,
    "costOutputTokens" INTEGER,
    "searchCount"      INTEGER NOT NULL DEFAULT 0,
    "cacheHitCount"    INTEGER NOT NULL DEFAULT 0,
    "error"            TEXT,
    "startedAt"        TIMESTAMP(3),
    "finishedAt"       TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Assessment" (
    "id"             TEXT NOT NULL,
    "candidateId"    TEXT NOT NULL,
    "indicatorId"    TEXT NOT NULL,
    "value"          INTEGER,
    "rationale"      TEXT,
    "weightOverride" DOUBLE PRECISION,
    "reviewStatus"   "ReviewStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "origin"         "Origin" NOT NULL DEFAULT 'AGENT',
    "agentRunId"     TEXT,
    "rubricVersion"  INTEGER NOT NULL DEFAULT 1,
    "supersedesId"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_candidateId_indicatorId_key" ON "Assessment"("candidateId", "indicatorId");
CREATE INDEX IF NOT EXISTS "Assessment_candidateId_idx" ON "Assessment"("candidateId");
CREATE INDEX IF NOT EXISTS "Assessment_indicatorId_idx" ON "Assessment"("indicatorId");

DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_candidateId_fkey"
        FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_indicatorId_fkey"
        FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_agentRunId_fkey"
        FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_supersedesId_fkey"
        FOREIGN KEY ("supersedesId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Source" (
    "id"          TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "url"         TEXT,
    "title"       TEXT,
    "excerpt"     TEXT,
    "publishedAt" TIMESTAMP(3),
    "status"      "SourceStatus" NOT NULL DEFAULT 'FOUND',
    "agentRunId"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Source_candidateId_idx" ON "Source"("candidateId");
DO $$ BEGIN
    ALTER TABLE "Source" ADD CONSTRAINT "Source_candidateId_fkey"
        FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Source" ADD CONSTRAINT "Source_agentRunId_fkey"
        FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AssessmentSource" (
    "assessmentId" TEXT NOT NULL,
    "sourceId"     TEXT NOT NULL,
    CONSTRAINT "AssessmentSource_pkey" PRIMARY KEY ("assessmentId", "sourceId")
);
DO $$ BEGIN
    ALTER TABLE "AssessmentSource" ADD CONSTRAINT "AssessmentSource_assessmentId_fkey"
        FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "AssessmentSource" ADD CONSTRAINT "AssessmentSource_sourceId_fkey"
        FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Correction" (
    "id"           TEXT NOT NULL,
    "agentRunId"   TEXT NOT NULL,
    "assessmentId" TEXT,
    "sourceId"     TEXT,
    "check"        TEXT NOT NULL,
    "field"        TEXT NOT NULL,
    "before"       TEXT,
    "after"        TEXT,
    "confidence"   DOUBLE PRECISION NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
    ALTER TABLE "Correction" ADD CONSTRAINT "Correction_agentRunId_fkey"
        FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Correction" ADD CONSTRAINT "Correction_assessmentId_fkey"
        FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Correction" ADD CONSTRAINT "Correction_sourceId_fkey"
        FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Flag" (
    "id"           TEXT NOT NULL,
    "agentRunId"   TEXT NOT NULL,
    "targetType"   TEXT NOT NULL,
    "targetId"     TEXT NOT NULL,
    "assessmentId" TEXT,
    "sourceId"     TEXT,
    "reason"       TEXT NOT NULL,
    "severity"     TEXT NOT NULL,
    "confidence"   DOUBLE PRECISION NOT NULL,
    "status"       "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
    ALTER TABLE "Flag" ADD CONSTRAINT "Flag_agentRunId_fkey"
        FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Flag" ADD CONSTRAINT "Flag_assessmentId_fkey"
        FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Flag" ADD CONSTRAINT "Flag_sourceId_fkey"
        FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SearchCache" (
    "id"              TEXT NOT NULL,
    "query"           TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "results"         JSONB NOT NULL,
    "resultCount"     INTEGER NOT NULL DEFAULT 0,
    "source"          TEXT NOT NULL DEFAULT 'SERPER',
    "fetchedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"       TIMESTAMP(3),
    "hitCount"        INTEGER NOT NULL DEFAULT 0,
    "candidateId"     TEXT,
    "indicatorId"     TEXT,
    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SearchCache_normalizedQuery_idx" ON "SearchCache"("normalizedQuery");
CREATE INDEX IF NOT EXISTS "SearchCache_candidateId_idx"     ON "SearchCache"("candidateId");
