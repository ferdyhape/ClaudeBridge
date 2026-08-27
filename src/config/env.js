import "dotenv/config";

// Centralizes every environment-derived setting in one place, so nothing
// else in the app reads `process.env` directly. That's the only reason
// this module exists: a single, obvious source of truth for "what can be
// configured from the outside" (Single Responsibility).
export const env = {
  port: process.env.PORT || 4577,

  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "claudebridge",
  },

  session: {
    cookieName: "csid",
    cookieMaxAgeMs: 400 * 24 * 60 * 60 * 1000, // ~13 months, the common cap browsers honor
    maxIdleDays: Number(process.env.SESSION_MAX_IDLE_DAYS || 30),
    cleanupIntervalMs: 6 * 60 * 60 * 1000, // how often the idle-session sweep runs
  },
};
