import mysql from "mysql2/promise";

const {
  MYSQL_HOST = "127.0.0.1",
  MYSQL_PORT = "3306",
  MYSQL_USER = "root",
  MYSQL_PASSWORD = "",
  MYSQL_DATABASE = "claude_submachine",
} = process.env;

const connectionBase = {
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
};

export let pool;

// Registry only: which browser session maps to which isolated config
// folder, and a cached view of its login state. The Claude OAuth tokens
// themselves are never written here — they stay as files under
// .claude-sessions/<id>/, which is the only place the `claude` CLI knows
// how to read them from.
export async function initDatabase() {
  const bootstrap = await mysql.createConnection(connectionBase);
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4`);
  await bootstrap.end();

  pool = mysql.createPool({
    ...connectionBase,
    database: MYSQL_DATABASE,
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
}

export async function ensureSession(id, { userAgent, ipAddress } = {}) {
  await pool.query(
    `INSERT INTO sessions (id, user_agent, ip_address) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE last_active_at = CURRENT_TIMESTAMP`,
    [id, userAgent || null, ipAddress || null]
  );
}

export async function touchSession(id) {
  await pool.query(`UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

export async function updateSessionAuth(id, { loggedIn, email, orgName }) {
  await pool.query(`UPDATE sessions SET logged_in = ?, email = ?, org_name = ? WHERE id = ?`, [
    loggedIn ? 1 : 0,
    email || null,
    orgName || null,
    id,
  ]);
}

export async function renameSession(id, label) {
  await pool.query(`UPDATE sessions SET label = ? WHERE id = ?`, [label || null, id]);
}

export async function listSessions() {
  const [rows] = await pool.query(`SELECT * FROM sessions ORDER BY last_active_at DESC`);
  return rows;
}

export async function findStaleSessionIds(maxIdleDays) {
  const [rows] = await pool.query(
    `SELECT id FROM sessions WHERE last_active_at < (NOW() - INTERVAL ? DAY)`,
    [maxIdleDays]
  );
  return rows.map((r) => r.id);
}

export async function deleteSession(id) {
  await pool.query(`DELETE FROM sessions WHERE id = ?`, [id]);
}
