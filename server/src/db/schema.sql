CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  tracking_id TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT '',
  recipients TEXT NOT NULL,
  is_reply INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_tracking_id ON emails(tracking_id);

CREATE TABLE IF NOT EXISTS opens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER NOT NULL REFERENCES emails(id),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_coarse TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_opens_email_id ON opens(email_id);

CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER NOT NULL REFERENCES emails(id),
  url TEXT NOT NULL,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_coarse TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_clicks_email_id ON clicks(email_id);
