import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./types";
import { emailsRoute } from "./routes/emails";
import { pixelRoute } from "./routes/pixel";
import { clickRoute } from "./routes/click";
import { dashboardRoute } from "./routes/dashboard";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// The extension calls the API from a content script running on
// mail.google.com, so this needs to be reachable cross-origin. There's no
// cookie-based session (auth is the X-Api-Key header), so a wide CORS
// policy here doesn't expose anything beyond what the header already gates.
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "X-Api-Key"],
    allowMethods: ["GET", "POST"],
  }),
);

app.get("/", (c) => c.text("readtrace-server ok"));

app.route("/api/emails", emailsRoute);
app.route("/p", pixelRoute);
app.route("/c", clickRoute);
app.route("/dashboard", dashboardRoute);

export default app;
