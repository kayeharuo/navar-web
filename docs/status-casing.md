# Status casing

Migration 64 normalizes all 25 textual business status columns in public tables to lowercase. This covers application, AR development, inquiry, stall, contract, account, store, beacon, payment, delivery and promotion status fields.

Each affected table has a BEFORE INSERT OR UPDATE normalizer and a lowercase check constraint. Clients may send existing capitalized status labels; stored values become lowercase before workflow validation. This applies across interfaces. Status codes retain their existing spaces or underscores; only letter casing changes.

The casing-only repair suppresses user triggers inside the migration transaction to avoid replaying approvals, notifications or other workflow actions. It restores the exact original enabled/disabled/always trigger modes before committing. Names, geographic states, message text, snapshots and archived JSON are unchanged.

AR Development formats the Agreement value separately, so database `active` displays as `Active`; application and development labels use the same capitalization. Inquiry responses also format display labels without changing stored values.

Verification: `test/lowercase-statuses.test.cjs` covers normalization, null values, unrelated fields, future writes before guards, notification suppression and trigger-mode restoration. `test/live-lowercase-statuses.sql` verifies all live status columns and future write behavior in a rolled-back transaction. The AR API was checked against live records for `Active`, `Setup`, `Approved`, `For Revision`, `Node Mapping`, `On Hold`, `Testing` and `Live` labels.
