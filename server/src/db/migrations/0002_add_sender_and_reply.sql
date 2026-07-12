-- Adds sender ("From") and is_reply tracking to already-deployed databases.
-- schema.sql already has these columns for fresh installs; this migration
-- is only needed against a database created before this change.
ALTER TABLE emails ADD COLUMN sender TEXT NOT NULL DEFAULT '';
ALTER TABLE emails ADD COLUMN is_reply INTEGER NOT NULL DEFAULT 0;
