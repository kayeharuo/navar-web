-- NavAR Store Management migration for an existing Supabase database.
-- Run after 01/02/03/06 in the Supabase SQL Editor.
-- This adds the mall relationship and fields required by Store Management.

BEGIN;

ALTER TABLE STORE
    ADD COLUMN IF NOT EXISTS MALL_ID INTEGER;

ALTER TABLE STORE
    ADD COLUMN IF NOT EXISTS STORE_TYPE VARCHAR(20) NOT NULL DEFAULT 'store';

ALTER TABLE STORE
    ADD COLUMN IF NOT EXISTS STORE_DESCRIPTION TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_store_mall_id'
    ) THEN
        ALTER TABLE STORE
            ADD CONSTRAINT fk_store_mall_id
            FOREIGN KEY (MALL_ID) REFERENCES MALL(MALL_ID);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_store_type'
    ) THEN
        ALTER TABLE STORE
            ADD CONSTRAINT ck_store_type
            CHECK (STORE_TYPE IN ('store', 'stall'));
    END IF;
END $$;

-- Existing rows cannot be assigned safely when their units belong to different
-- malls. Assign only unambiguous rows; review any remaining NULL values.
UPDATE STORE AS store
SET MALL_ID = source.MALL_ID
FROM (
    SELECT unit.STORE_ID, MIN(floor.MALL_ID) AS MALL_ID
    FROM UNIT AS unit
    JOIN FLOOR AS floor ON floor.FLOOR_ID = unit.FLOOR_ID
    WHERE unit.STORE_ID IS NOT NULL
    GROUP BY unit.STORE_ID
    HAVING COUNT(DISTINCT floor.MALL_ID) = 1
) AS source
WHERE store.STORE_ID = source.STORE_ID
  AND store.MALL_ID IS NULL;

COMMIT;

-- Review this before making MALL_ID NOT NULL:
-- SELECT STORE_ID, STORE_NAME FROM STORE WHERE MALL_ID IS NULL;
