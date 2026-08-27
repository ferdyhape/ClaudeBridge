import { createApp } from "./src/app.js";
import { initDatabase } from "./src/db/pool.js";
import { scheduleCleanup } from "./src/services/sessionLifecycle.js";
import { SESSIONS_ROOT } from "./src/config/claude.js";
import { env } from "./src/config/env.js";

const app = createApp();

app.listen(env.port, async () => {
  console.log(`Claude sub-machine listening on http://localhost:${env.port}`);
  console.log(`Per-session credentials under: ${SESSIONS_ROOT}`);

  try {
    await initDatabase();
    console.log("MySQL session registry ready.");
  } catch (err) {
    console.error("Could not initialize MySQL:", err.message);
    console.error("Set MYSQL_HOST/PORT/USER/PASSWORD/DATABASE in .env and make sure the server is running.");
    process.exit(1);
  }

  scheduleCleanup();
});
