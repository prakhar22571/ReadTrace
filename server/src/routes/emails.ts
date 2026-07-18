import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireApiKey } from "../lib/auth";

export const emailsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

emailsRoute.use("*", requireApiKey);

emailsRoute.post("/", async (c) => {
  const body = await c.req.json<{
    trackingId?: string;
    subject?: string;
    sender?: string;
    recipients?: string;
    isReply?: boolean;
  }>();

  if (!body.trackingId || !body.subject || !body.recipients) {
    return c.json(
      { error: "trackingId, subject and recipients are required" },
      400,
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO emails (tracking_id, subject, sender, recipients, is_reply)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(tracking_id) DO NOTHING`,
  )
    .bind(body.trackingId, body.subject, body.sender ?? "", body.recipients, body.isReply ? 1 : 0)
    .run();

  return c.json({ ok: true, trackingId: body.trackingId }, 201);
});

emailsRoute.get("/", async (c) => {
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
     LIMIT 200`,
  ).all();

  return c.json({ emails: results });
});
