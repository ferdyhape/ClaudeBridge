import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../api";
import Icon from "./Icon";

function formatDate(s) {
  if (!s) return "belum pernah dipakai";
  return new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function ApiKeysPanel() {
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null); // { key, name } | null
  const [copied, setCopied] = useState(false);

  function load() {
    apiGet("/auth/api-keys")
      .then((res) => setKeys(res.rows))
      .catch(() => setKeys([]));
  }

  useEffect(load, []);

  async function create() {
    setCreating(true);
    try {
      const created = await apiPost("/auth/api-keys", { name: name.trim() });
      setName("");
      setNewKey(created);
      setCopied(false);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id) {
    if (!confirm("Cabut API key ini? Klien yang pakai key ini akan langsung berhenti bisa akses.")) return;
    await apiDelete(`/auth/api-keys/${id}`).catch(() => {});
    load();
  }

  async function copyNewKey() {
    try {
      await navigator.clipboard.writeText(newKey.key);
      setCopied(true);
    } catch {
      /* clipboard unavailable; the key stays selectable by hand */
    }
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
      <div className="flex items-center gap-2">
        <Icon name="key" className="h-[18px] w-[18px] text-primary" />
        <h2 className="font-display text-base font-semibold text-on-surface">API Keys</h2>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
        Untuk akses lewat API (bukan browser) — key mewakili akun yang sama dengan sesi ini. Nilainya cuma
        ditampilkan sekali saat dibuat.
      </p>

      <div className="mt-4 space-y-2">
        {keys === null && <div className="text-sm text-on-surface-variant">Memuat…</div>}
        {keys?.length === 0 && <div className="text-sm text-on-surface-variant">Belum ada API key.</div>}
        {keys?.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3.5 py-2.5"
          >
            <div className="min-w-0 text-sm">
              <span className="font-mono text-on-surface">{k.key_prefix}…</span>
              <span className="ml-2 text-on-surface-variant">{k.name}</span>
              <div className="text-xs text-on-surface-variant">Dipakai terakhir {formatDate(k.last_used_at)}</div>
            </div>
            <button
              type="button"
              onClick={() => revoke(k.id)}
              className="focus-ring flex shrink-0 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-medium text-on-surface-variant hover:border-error/40 hover:text-error"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
              Cabut
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder='Nama key (mis. "script backup")'
          className="focus-ring flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
        />
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="focus-ring shrink-0 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
        >
          Buat key baru
        </button>
      </div>

      {newKey && (
        <div className="mt-4 rounded-lg border border-success/35 bg-success-container/40 p-3.5">
          <div className="text-sm font-semibold text-success">Simpan sekarang — key ini tidak akan ditampilkan lagi.</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-surface-container-lowest px-3 py-2 font-mono text-xs text-on-surface">
              {newKey.key}
            </code>
            <button
              type="button"
              onClick={copyNewKey}
              className="focus-ring shrink-0 flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-high"
            >
              <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
              {copied ? "Disalin" : "Salin"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
