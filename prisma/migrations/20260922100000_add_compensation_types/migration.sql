-- Multi-select compensation types. The legacy single "compensationType"
-- column is kept (derived: first selection, or PAID_PLUS_GIFT when both
-- PAID and GIFTED are chosen) for existing filters and badges.
ALTER TABLE "campaigns" ADD COLUMN "compensationTypes" "CompensationType"[] DEFAULT ARRAY[]::"CompensationType"[];

-- Backfill existing campaigns from the legacy value
UPDATE "campaigns" SET "compensationTypes" = CASE
  WHEN "compensationType" = 'PAID_PLUS_GIFT' THEN ARRAY['PAID', 'GIFTED']::"CompensationType"[]
  ELSE ARRAY["compensationType"]::"CompensationType"[]
END;
