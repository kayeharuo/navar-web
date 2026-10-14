-- Convert legacy wall-clock timestamps to timezone-aware timestamps.
--
-- Assumption: existing TIMESTAMP WITHOUT TIME ZONE values were written as
-- UTC wall-clock values. The USING expression preserves that instant and
-- attaches UTC before PostgreSQL displays it in the configured timezone.
--
-- Run this migration during a maintenance window after taking a database
-- backup. ALTER TABLE acquires a lock while each column is converted.

DO $$
DECLARE
    column_record RECORD;
BEGIN
    FOR column_record IN
        SELECT
            c.table_schema,
            c.table_name,
            c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.data_type = 'timestamp without time zone'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE %L',
            column_record.table_schema,
            column_record.table_name,
            column_record.column_name,
            column_record.column_name,
            'UTC'
        );
    END LOOP;
END
$$;

-- Supabase may restrict ALTER DATABASE for hosted projects. If the project
-- permits it, run this separately (ALTER DATABASE cannot run inside a DO
-- block). Otherwise configure the timezone per connection:
-- ALTER DATABASE postgres SET timezone TO 'Asia/Manila';
SET TIME ZONE 'Asia/Manila';
