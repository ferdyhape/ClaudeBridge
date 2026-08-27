import mysql from "mysql2/promise";
import { env } from "../config/env.js";

// The only module that knows how to reach MySQL at all — every other
// module that needs data goes through sessionRepository.js instead of
// touching this pool directly (Interface Segregation: callers see a
// handful of purpose-built functions, never the raw connection).
export let pool;

export async function initDatabase() {
  const bootstrap = await mysql.createConnection({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
  });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${env.mysql.database}\` CHARACTER SET utf8mb4`);
  await bootstrap.end();

  pool = mysql.createPool({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    database: env.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id CHAR(36) PRIMARY KEY,
      label VARCHAR(255) NULL,
      email VARCHAR(255) NULL,
      org_name VARCHAR(255) NULL,
      logged_in TINYINT(1) NOT NULL DEFAULT 0,
      user_agent VARCHAR(255) NULL,
      ip_address VARCHAR(45) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Only the SHA-256 hash of a key is ever stored — the plaintext exists
  // for exactly one response, at creation time, and nowhere else. Tied to
  // its session with ON DELETE CASCADE so retiring/expiring a session
  // (see sessionLifecycle.js) automatically revokes every key under it.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id CHAR(36) PRIMARY KEY,
      session_id CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      key_hash CHAR(64) NOT NULL,
      key_prefix VARCHAR(20) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME NULL,
      UNIQUE KEY uniq_key_hash (key_hash),
      INDEX idx_session (session_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
