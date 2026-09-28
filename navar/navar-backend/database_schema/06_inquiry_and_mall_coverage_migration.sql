-- Apply this migration to an existing Supabase database after 01/02/03.
-- It is safe to run once and uses IF NOT EXISTS guards for columns.
-- This does not modify 01_navar_schema.sql.

BEGIN;

ALTER TABLE INQUIRY
    ADD COLUMN IF NOT EXISTS INQUIRY_COVERAGE_AREA VARCHAR(150);

ALTER TABLE MALL
    ADD COLUMN IF NOT EXISTS MALL_COVERAGE_AREA VARCHAR(150);

ALTER TABLE OPERATING_HOURS
    ADD COLUMN IF NOT EXISTS OPTHRS_IS_INQUIRY BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE OPERATING_HOURS
    ADD COLUMN IF NOT EXISTS INQUIRY_ID INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_operating_hours_inquiry_id'
    ) THEN
        ALTER TABLE OPERATING_HOURS
            ADD CONSTRAINT fk_operating_hours_inquiry_id
            FOREIGN KEY (INQUIRY_ID) REFERENCES INQUIRY(INQUIRY_ID);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_mall_coverage_area'
    ) THEN
        ALTER TABLE MALL
            ADD CONSTRAINT ck_mall_coverage_area CHECK (
                MALL_COVERAGE_AREA IS NULL
                OR MALL_COVERAGE_AREA IN (
                    'Less than or equal to 15,000 sqm',
                    'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm',
                    'Greater than 50,000 sqm, but less than or equal to 150,000 sqm',
                    'Greater than 150,000 sqm'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_inquiry_coverage_area'
    ) THEN
        ALTER TABLE INQUIRY
            ADD CONSTRAINT ck_inquiry_coverage_area CHECK (
                INQUIRY_COVERAGE_AREA IS NULL
                OR INQUIRY_COVERAGE_AREA IN (
                    'Less than or equal to 15,000 sqm',
                    'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm',
                    'Greater than 50,000 sqm, but less than or equal to 150,000 sqm',
                    'Greater than 150,000 sqm'
                )
            );
    END IF;
END $$;

-- Existing operating-hour rows are mall/store rows, not inquiry rows.
UPDATE OPERATING_HOURS
SET OPTHRS_IS_INQUIRY = FALSE,
    INQUIRY_ID = NULL
WHERE OPTHRS_IS_INQUIRY IS DISTINCT FROM FALSE
   OR INQUIRY_ID IS NOT NULL;

-- Existing malls receive the requested second coverage option.
UPDATE MALL
SET MALL_COVERAGE_AREA = 'Greater than 15,000 sqm, but lesser than or equal to 50,000 sqm'
WHERE MALL_COVERAGE_AREA IS NULL;

COMMIT;
