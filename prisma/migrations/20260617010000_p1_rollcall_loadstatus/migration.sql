-- P1: Add load-status tracking to RollCall for bill vote pipeline.

ALTER TABLE "RollCall"
  ADD COLUMN IF NOT EXISTS "loadStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "loadedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "loadError"  TEXT;
