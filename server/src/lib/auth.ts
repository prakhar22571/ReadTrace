import type { Context, Next } from "hono";
import type { Env, Variables } from "../types";
import { constantTimeEqual } from "./session";

/**
 * This project is single-owner, so there's no per-user account model - the
 * X-Api-Key header just has to match the API_KEY Worker secret, the same
 * pattern as the dashboard password.
 */
export async function requireApiKey(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
) {
  const apiKey = c.req.header("X-Api-Key") ?? "";
  const ok = await constantTimeEqual(apiKey, c.env.API_KEY);
  if (!ok) {
    return c.json({ error: "missing or invalid X-Api-Key header" }, 401);
  }

  await next();
}

/** Drops the last IPv4 octet / last two IPv6 groups so we log a coarse location, not a precise one. */
export function coarsenIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, Math.max(1, parts.length - 2)).join(":") + "::";
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
}
