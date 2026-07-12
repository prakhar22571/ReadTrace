# MailTrack (Free)

A self-hosted, free clone of [Mailtrack.io](https://mailtrack.io): a Chrome
extension that adds WhatsApp-style read receipts and link-click tracking to
Gmail, backed by a Cloudflare Worker instead of a paid SaaS.

It works the same way the real thing does: a content script silently appends
an invisible tracking pixel to outgoing mail and rewrites links to route
through a tracking redirect, and a backend logs opens/clicks against a
per-email tracking ID.

## Project layout

- `server/` - Cloudflare Worker (Hono) + D1 (SQLite). Serves the tracking
  pixel, the link-click redirect, and a small JSON API for the extension's
  popup/badges.
- `extension/` - Manifest V3 Chrome extension (TypeScript + Vite/crxjs).
  Injects into Gmail's compose window, shows a popup dashboard, and renders
  inline read-receipt badges.

## 1. Deploy the backend

```
cd server
npm install
npx wrangler login                     # one-time Cloudflare auth
npx wrangler d1 create mailtrack       # copy the returned database_id into wrangler.toml
npm run db:migrate:remote              # applies src/db/schema.sql to the remote D1 db
npm run deploy                         # deploys to https://mailtrack-server.<you>.workers.dev
```

All of this runs on Cloudflare's free tier (100k requests/day, 5GB D1
storage) - no credit card required, no ongoing cost at personal/small-team
scale.

For local development instead: `npm run db:migrate:local && npm run dev`
(serves on `http://127.0.0.1:8787`, which is the extension's default).

## 2. Build and load the extension

```
cd extension
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select `extension/dist`.

Click the extension icon → **Settings**, and set **Backend server URL** to
your deployed Worker URL from step 1 (or leave it as the local dev default
while testing).

## 3. Use it

Open Gmail, start composing. A small eye icon (👁️) appears next to the Send
button - tracking is on by default; click it to toggle off per-email. Send
normally. The popup shows every tracked email with its open/click status, and
matching threads get inline ✓ / ✓✓ badges in the Gmail list view.

## 4. Web dashboard

`https://<your-worker>.workers.dev/dashboard` is a password-protected page
showing every tracked email with stats (open rate, total clicks) - useful for
checking status from any device, not just the browser with the extension.

Set the login password once (pick your own, or generate a strong random one):

```
cd server
npx wrangler secret put DASHBOARD_PASSWORD
npx wrangler secret put SESSION_SECRET   # any random string; internal session-signing key, never typed by you
```

Login issues an HTTP-only, `SameSite=Strict` session cookie (HMAC-signed, 30
day expiry) - there's no separate user system, this dashboard is meant for a
single owner. Log out from the button in the dashboard header, which clears
the cookie immediately.

## Known limitations

- **Gmail's image proxy caches the tracking pixel.** Gmail routes external
  images (including the tracking pixel) through Google's own proxy, which
  caches by URL. This means a second/third open of the same email is not
  reliably re-counted, and the logged IP is usually Google's proxy, not the
  recipient's. This is a limitation of *all* pixel-based Gmail trackers,
  including the real Mailtrack - there's no full workaround, only mitigation.
- **Inline badge matching is heuristic**, not exact: it matches Gmail list
  rows by subject-text substring rather than a stable message ID, since
  Gmail's DOM has no reliable public IDs to key off. Two unrelated threads
  with the exact same subject could both get badged.
- **No OAuth / Gmail API** is used on purpose - the extension only touches
  Gmail's rendered DOM. This avoids Google's OAuth consent-screen review
  process for sensitive scopes, keeping self-hosting frictionless, but it
  also means Gmail UI changes can break the compose hook or badge renderer
  and require selector updates.
