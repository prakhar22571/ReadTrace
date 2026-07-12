import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { coarsenIp } from "../lib/auth";
import { transparentPngBytes } from "../lib/pixel";

export const pixelRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /p/:trackingId.png - logs an open event, always returns the pixel
// regardless of whether the trackingId is known (never leak tracking state
// to the response, and never fail the image load in the recipient's client).
pixelRoute.get("/:trackingIdPng", async (c) => {
  const trackingId = c.req.param("trackingIdPng").replace(/\.png$/i, "");

  const email = await c.env.DB.prepare(
    "SELECT id FROM emails WHERE tracking_id = ?",
  )
    .bind(trackingId)
    .first<{ id: number }>();

  if (email) {
    const ip = coarsenIp(c.req.header("CF-Connecting-IP") ?? null);
    const userAgent = c.req.header("User-Agent") ?? null;
    await c.env.DB.prepare(
      "INSERT INTO opens (email_id, ip_coarse, user_agent) VALUES (?, ?, ?)",
    )
      .bind(email.id, ip, userAgent)
      .run();
  }

  return new Response(transparentPngBytes(), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
});
