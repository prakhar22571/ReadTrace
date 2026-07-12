import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { coarsenIp } from "../lib/auth";

export const clickRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /c/:trackingId?u=<encoded original url> - logs a click, then redirects.
clickRoute.get("/:trackingId", async (c) => {
  const trackingId = c.req.param("trackingId");
  const rawUrl = c.req.query("u");

  if (!rawUrl) {
    return c.json({ error: "missing u query param" }, 400);
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return c.json({ error: "invalid url" }, 400);
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return c.json({ error: "unsupported url scheme" }, 400);
  }

  const email = await c.env.DB.prepare(
    "SELECT id FROM emails WHERE tracking_id = ?",
  )
    .bind(trackingId)
    .first<{ id: number }>();

  if (email) {
    const ip = coarsenIp(c.req.header("CF-Connecting-IP") ?? null);
    const userAgent = c.req.header("User-Agent") ?? null;
    await c.env.DB.prepare(
      "INSERT INTO clicks (email_id, url, ip_coarse, user_agent) VALUES (?, ?, ?, ?)",
    )
      .bind(email.id, target.toString(), ip, userAgent)
      .run();
  }

  return c.redirect(target.toString(), 302);
});
