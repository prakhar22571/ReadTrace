import { Hono, type Context } from "hono";
import type { Env, Variables } from "../types";
import { constantTimeEqual, createSessionToken, getCookie, verifySessionToken } from "../lib/session";
import { dashboardPage, loginPage } from "../dashboard/templates";

export const dashboardRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

const SESSION_COOKIE = "mt_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches session.ts TTL

async function hasValidSession(c: Context<{ Bindings: Env; Variables: Variables }>): Promise<boolean> {
  const token = getCookie(c.req.raw, SESSION_COOKIE);
  return verifySessionToken(token, c.env.SESSION_SECRET);
}

function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

const CLEAR_COOKIE_HEADER = `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

dashboardRoute.get("/login", async (c) => {
  if (await hasValidSession(c)) return c.redirect("/dashboard");
  return c.html(loginPage());
});

dashboardRoute.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const password = typeof body.password === "string" ? body.password : "";

  const ok = await constantTimeEqual(password, c.env.DASHBOARD_PASSWORD);
  if (!ok) {
    return c.html(loginPage("Incorrect password."), 401);
  }

  const token = await createSessionToken(c.env.SESSION_SECRET);
  c.header("Set-Cookie", sessionCookieHeader(token));
  return c.redirect("/dashboard");
});

dashboardRoute.post("/logout", async (c) => {
  c.header("Set-Cookie", CLEAR_COOKIE_HEADER);
  return c.redirect("/dashboard/login");
});

dashboardRoute.get("/", async (c) => {
  if (!(await hasValidSession(c))) return c.redirect("/dashboard/login");
  return c.html(dashboardPage());
});

dashboardRoute.get("/api/emails", async (c) => {
  if (!(await hasValidSession(c))) return c.json({ error: "unauthorized" }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT
       e.tracking_id AS trackingId,
       e.subject AS subject,
       e.sender AS sender,
       e.recipients AS recipients,
       e.is_reply AS isReply,
       e.sent_at AS sentAt,
       (SELECT COUNT(*) FROM opens o WHERE o.email_id = e.id) AS openCount,
       (SELECT MAX(o.opened_at) FROM opens o WHERE o.email_id = e.id) AS lastOpenedAt,
       (SELECT COUNT(*) FROM clicks cl WHERE cl.email_id = e.id) AS clickCount
     FROM emails e
     ORDER BY e.sent_at DESC
     LIMIT 500`,
  ).all();

  return c.json({ emails: results });
});
