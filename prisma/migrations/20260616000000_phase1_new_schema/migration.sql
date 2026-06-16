-- Phase 1: Replace Score/ScoreComponent with Indicator/Assessment/Source pipeline

-- Drop old tables (CASCADE removes FK references automatically)
DROP TABLE IF EXISTS "ScoreComponent" CASCADE;
DROP TABLE IF EXISTS "Score" CASCADE;
DROP TYPE IF EXISTS "ComponentType";

-- New enums
CREATE TYPE "IndicatorType" AS ENUM ('BILL_VOTE', 'PUBLIC_STATEMENT', 'CAMPAIGN_STATEMENT', 'CUSTOM');
CREATE TYPE "ReviewStatus" AS ENUM ('UNVERIFIED', 'MACHINE_VERIFIED', 'AUTO_CORRECTED', 'FLAGGED', 'HUMAN_REVIEWED');
CREATE TYPE "Origin" AS ENUM ('AGENT', 'HUMAN');
CREATE TYPE "AgentRunType" AS ENUM ('CANDIDATE_FINDER', 'RESEARCHER', 'ASSESSOR', 'VERIFIER');
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');
CREATE TYPE "SourceStatus" AS ENUM ('FOUND', 'VERIFIED', 'REJECTED');
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'RESOLVED');

-- Extend Candidate with pipeline fields
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "office" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "electionYear" INTEGER;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- Indicator
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IndicatorType" NOT NULL,
    "rubric" TEXT NOT NULL,
    "rubricVersion" INTEGER NOT NULL DEFAULT 1,
    "weight" DOUBLE PRECISION,
    "appliesToGroupId" TEXT,
    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Indicator_questionId_idx" ON "Indicator"("questionId");
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_appliesToGroupId_fkey"
    FOREIGN KEY ("appliesToGroupId") REFERENCES "CandidateGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WeightingProfile
CREATE TABLE "WeightingProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WeightingProfile_pkey" PRIMARY KEY ("id")
);

-- TypeWeight
CREATE TABLE "TypeWeight" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "IndicatorType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "TypeWeight_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TypeWeight_profileId_type_key" ON "TypeWeight"("profileId", "type");
ALTER TABLE "TypeWeight" ADD CONSTRAINT "TypeWeight_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "WeightingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentRun (no FK dependencies, referenced by others)
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "type" "AgentRunType" NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "scope" JSONB,
    "provider" TEXT,
    "model" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "costInputTokens" INTEGER,
    "costOutputTokens" INTEGER,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "cacheHitCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- Assessment
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "value" INTEGER,
    "rationale" TEXT,
    "weightOverride" DOUBLE PRECISION,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "origin" "Origin" NOT NULL DEFAULT 'AGENT',
    "agentRunId" TEXT,
    "rubricVersion" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Assessment_candidateId_indicatorId_key" ON "Assessment"("candidateId", "indicatorId");
CREATE INDEX "Assessment_candidateId_idx" ON "Assessment"("candidateId");
CREATE INDEX "Assessment_indicatorId_idx" ON "Assessment"("indicatorId");
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_indicatorId_fkey"
    FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_supersedesId_fkey"
    FOREIGN KEY ("supersedesId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Source
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "excerpt" TEXT,
    "publishedAt" TIMESTAMP(3),
    "status" "SourceStatus" NOT NULL DEFAULT 'FOUND',
    "agentRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Source_candidateId_idx" ON "Source"("candidateId");
ALTER TABLE "Source" ADD CONSTRAINT "Source_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AssessmentSource (join table)
CREATE TABLE "AssessmentSource" (
    "assessmentId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    CONSTRAINT "AssessmentSource_pkey" PRIMARY KEY ("assessmentId", "sourceId")
);
ALTER TABLE "AssessmentSource" ADD CONSTRAINT "AssessmentSource_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentSource" ADD CONSTRAINT "AssessmentSource_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Correction
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "sourceId" TEXT,
    "check" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Flag
CREATE TABLE "Flag" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "sourceId" TEXT,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SearchCache
CREATE TABLE "SearchCache" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'SERPER',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "candidateId" TEXT,
    "indicatorId" TEXT,
    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SearchCache_normalizedQuery_idx" ON "SearchCache"("normalizedQuery");
CREATE INDEX "SearchCache_candidateId_idx" ON "SearchCache"("candidateId");
