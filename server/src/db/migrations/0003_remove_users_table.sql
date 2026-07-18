-- This project is single-owner: authentication is now one shared API key
-- (an API_KEY Worker secret) instead of per-installation auto-provisioned
-- accounts, so the users table and per-email user scoping no longer serve
-- a purpose. schema.sql already reflects this for fresh installs; this
-- migration is only needed against a database created before this change.
DROP INDEX IF EXISTS idx_emails_user_id;
ALTER TABLE emails DROP COLUMN user_id;
DROP TABLE IF EXISTS users;
