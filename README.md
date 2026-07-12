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
  pixel, the link-click redirect, the password-protected web dashboard, and
  a small JSON API for the extension's popup/badges.
- `extension/` - Manifest V3 Chrome extension (TypeScript + Vite/crxjs).
  Injects into Gmail's compose window, shows a popup dashboard, and renders
  inline read-receipt badges.

## Prerequisites

- Node.js 18+ and npm (built and tested with Node 20)
- Git
- A free Cloudflare account - sign up at https://dash.cloudflare.com/sign-up,
  no credit card required
- Chrome or a Chromium-based browser (Brave, Edge, etc.) signed into Gmail

## Setup from scratch

### 1. Get the code

```
git clone https://github.com/prakhar22571/MailTrack.git
cd MailTrack
```

### 2. Deploy the backend

```
cd server
npm install
npx wrangler login
```

This opens your browser to log into (or sign up for) Cloudflare and
authorize the Wrangler CLI. If it can't reach your browser (a remote or
sandboxed dev environment, WSL without a browser bridge), see "Can't
complete `wrangler login`?" below for an API-token alternative.

Create your own D1 database:

```
npx wrangler d1 create mailtrack
```

This prints a `database_id`. **Open `server/wrangler.toml` and replace the
`database_id` value with the one you just got** - the committed value is
this project's original deployment under a different Cloudflare account, so
it won't work for you as-is.

Apply the schema and deploy:

```
npm run db:migrate:remote
npm run deploy
```

Wrangler prints your Worker's URL, e.g.
`https://mailtrack-server.<your-subdomain>.workers.dev` - that's your
backend. Copy it, you'll need it for the extension.

If deploy fails with "You need to register a workers.dev subdomain," go to
the Cloudflare dashboard -> Workers & Pages -> your worker -> **Domains**
tab, and toggle the `workers.dev` URL on.

#### Set the dashboard password

```
npx wrangler secret put DASHBOARD_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Each command prompts you to type a value (hidden input). `DASHBOARD_PASSWORD`
is what you'll type to log into `/dashboard` later - pick something you'll
remember or save in a password manager. `SESSION_SECRET` is only used
internally to sign login sessions; any random string works and you'll never
need to type it again. Both are stored as encrypted Cloudflare secrets -
never written to a file, never committed anywhere.

#### Can't complete `wrangler login`?

If `wrangler login`'s browser-based OAuth flow hangs or fails (common in
remote/sandboxed environments where the CLI and your browser can't reach
each other), authenticate with an API token instead:

1. Go to https://dash.cloudflare.com/profile/api-tokens -> **Create Token**
   -> **Create Custom Token**.
2. Add permissions: `Account` -> `D1` -> `Edit`, and `Account` ->
   `Workers Scripts` -> `Edit`. If `wrangler d1 create` later fails with an
   authentication error on `/memberships`, also add `Account` ->
   `Account Settings` -> `Read`, `User` -> `User Details` -> `Read`, and
   `User` -> `Memberships` -> `Read`.
3. Copy the generated token, then run any `wrangler` command with it set as
   an environment variable instead of logging in:
   ```
   CLOUDFLARE_API_TOKEN=<your-token> npx wrangler deploy
   ```
   (PowerShell: `$env:CLOUDFLARE_API_TOKEN="<your-token>"` first, then run
   the command normally.)

For local development instead of deploying: `npm run db:migrate:local &&
npm run dev` (serves on `http://127.0.0.1:8787`, which is the extension's
default server URL).

### 3. Build and load the extension

```
cd extension
npm install
npm run build
```

Then in Chrome/Brave: go to `chrome://extensions`, enable **Developer mode**
(top-right toggle), click **Load unpacked**, and select `extension/dist`.

Click the extension icon in your toolbar -> **Settings**, and set **Backend
server URL** to the Worker URL from step 2.

### 4. Use it

Open Gmail, start composing (new message or reply). A small eye icon (👁️)
appears next to Send - tracking is on by default; click it to toggle off for
that email. Send normally.

- The **extension popup** (click the toolbar icon) lists every tracked email
  with sender, recipient, and open/click status.
- Matching threads get inline ✓ (sent) / ✓✓ (opened) badges in Gmail's list
  view.
- The **web dashboard** (below) gives a fuller view from any device, not
  just the browser with the extension installed.

## Backend hosting

The backend is a Cloudflare Worker, not a traditional server - there's
nothing for you to keep running, patch, or rent a VPS for. It executes on
Cloudflare's edge network on demand, whenever a tracking pixel loads, a link
is clicked, or the dashboard is opened. It's always available and doesn't
depend on your computer being on.

Everything runs on Cloudflare's free tier:

- **Workers**: 100,000 requests/day. Each tracked email costs roughly 2-3
  requests total (register, pixel load, maybe a click) - you'd need to send
  tens of thousands of emails a day to approach this limit.
- **D1** (the SQLite database storing tracked emails/opens/clicks): 5GB
  storage, millions of row reads/day.
- **`*.workers.dev` subdomain**: free, no renewal, no custom domain needed.

No credit card is required for any of this, and none is added by following
this guide. Without a payment method on file, Cloudflare has no way to
charge you even if you somehow exceeded free-tier limits - it would just
throttle or return an error instead of billing. The only way this ever costs
money is if you deliberately add billing info and upgrade to a paid plan
yourself later.

## Web dashboard

`https://<your-worker>.workers.dev/dashboard` is a password-protected page
showing every tracked email in a table: **Subject**, **From** (the sending
account, read from Gmail's own account-switcher UI), **Recipients** (tagged
`(reply)` when the email was a reply rather than a new message), **Sent**
time, **Status** (opened or not, with open count), and link **Clicks** -
plus summary stats (tracked emails, opened, open rate, total clicks).

**Security model**: logging in checks your password with a timing-safe
comparison, then issues an HTTP-only, `SameSite=Strict`, HMAC-signed session
cookie (30-day expiry) - no third-party auth, no separate user accounts,
since this is meant for a single owner. Log out from the button in the
header, which clears the cookie immediately.

To change the password later, just re-run:

```
npx wrangler secret put DASHBOARD_PASSWORD
```

This takes effect immediately for future logins. Existing sessions stay
valid until they expire or you explicitly log out, since sessions are
cryptographically signed independently of the password itself.

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
- **"From" and reply detection are best-effort.** The sender is read from
  Gmail's account-switcher UI, so it won't reflect a different "Send mail
  as" alias picked inside compose. Reply detection works by checking
  whether the compose window shows a subject field (new emails and forwards
  do, replies don't) - accurate for normal use, but not based on any
  explicit signal Gmail exposes.
- **No OAuth / Gmail API** is used on purpose - the extension only touches
  Gmail's rendered DOM. This avoids Google's OAuth consent-screen review
  process for sensitive scopes, keeping self-hosting frictionless, but it
  also means Gmail UI changes can break the compose hook or badge renderer
  and require selector updates.
- **After reloading the extension** in `chrome://extensions`, close and
  reopen any Gmail tabs that were already open rather than just refreshing
  them - an already-open tab's content script can be left pointing at the
  old, now-invalidated extension instance, silently breaking tracking on
  that tab until it's fully reloaded.
