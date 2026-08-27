import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import LoginPanel from "../components/LoginPanel";
import ApiKeysPanel from "../components/ApiKeysPanel";

export default function Account() {
  const [status, setStatus] = useState(null); // null while loading
  const [loggingOut, setLoggingOut] = useState(false);

  function refreshStatus() {
    apiGet("/auth/status")
      .then(setStatus)
      .catch(() => setStatus({ loggedIn: false }));
  }

  useEffect(refreshStatus, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiPost("/auth/logout");
    } finally {
      setLoggingOut(false);
      refreshStatus();
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Akun</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-on-surface">Login &amp; API Keys</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
        Setiap akun Claude yang login di sini terisolasi sepenuhnya — kredensial, riwayat, dan API key-nya
        masing-masing terpisah, tidak pernah tercampur dengan akun lain.
      </p>

      <div className="mt-6 space-y-4">
        {status === null && <div className="text-sm text-on-surface-variant">Memuat…</div>}

        {status && !status.loggedIn && <LoginPanel onLoggedIn={refreshStatus} />}

        {status?.loggedIn && (
          <>
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Badge variant="success">login</Badge>
                  <div className="mt-2 text-sm text-on-surface">
                    <span className="font-medium">{status.email || "(tanpa email)"}</span>
                    {status.orgName && <span className="text-on-surface-variant"> · {status.orgName}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="focus-ring flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant hover:border-error/40 hover:text-error disabled:opacity-50"
                >
                  <Icon name="logout" className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>

            <ApiKeysPanel />
          </>
        )}
      </div>
    </div>
  );
}
