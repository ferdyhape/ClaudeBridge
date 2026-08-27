import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../api";
import Icon from "./Icon";

const URL_RE = /https?:\/\/\S+/g;

export default function LoginPanel({ onLoggedIn }) {
  const [active, setActive] = useState(false);
  const [logText, setLogText] = useState("");
  const [codeValue, setCodeValue] = useState("");
  const [result, setResult] = useState(null); // { ok: boolean, message: string } | null
  const [starting, setStarting] = useState(false);
  const eventSourceRef = useRef(null);
  const cancellingRef = useRef(false);

  useEffect(() => {
    apiGet("/auth/login/state")
      .then((state) => {
        if (state.active) {
          setActive(true);
          connectStream(state.log);
        }
      })
      .catch(() => {});
    return () => eventSourceRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connectStream(initialLog) {
    setLogText(initialLog || "");
    eventSourceRef.current?.close();
    const es = new EventSource("/auth/login/stream");
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      if (evt.type === "output") {
        setLogText((prev) => prev + evt.text);
      } else if (evt.type === "exit") {
        onExit(evt.code);
      }
    };
  }

  function onExit(code) {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setActive(false);

    if (cancellingRef.current) {
      cancellingRef.current = false;
      setResult({ ok: null, message: "Login dibatalkan." });
    } else if (code === 0) {
      setResult({ ok: true, message: "Login berhasil!" });
      onLoggedIn();
    } else {
      setResult({ ok: false, message: "Login gagal atau ditutup sebelum selesai. Lihat log di atas, lalu coba lagi." });
    }
  }

  async function start() {
    setStarting(true);
    setResult(null);
    setLogText("");
    setCodeValue("");
    setActive(true);
    connectStream("");
    try {
      await apiPost("/auth/login/start");
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    cancellingRef.current = true;
    await apiPost("/auth/login/cancel").catch(() => {});
  }

  async function submitCode() {
    const text = codeValue.trim();
    if (!text) return;
    setCodeValue("");
    await apiPost("/auth/login/input", { text }).catch(() => {});
  }

  const urls = logText.match(URL_RE);
  const loginUrl = urls?.[urls.length - 1];
  const needsCode = /paste code/i.test(logText);

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
      <p className="text-sm leading-relaxed text-on-surface-variant">
        Login memakai akun Claude/Anthropic lewat browser (perlu subscription Pro/Max/Team). Kredensial disimpan
        lokal di server, terpisah per akun — tidak pernah tercampur dengan akun lain.
      </p>

      {!active && (
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="focus-ring mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
        >
          Mulai Login
        </button>
      )}

      {active && (
        <div className="mt-4 space-y-3">
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-inverse-surface p-3 font-mono text-xs leading-relaxed text-inverse-on-surface/85">
            {logText || "Menunggu keluaran…"}
          </pre>

          {loginUrl && (
            <a
              href={loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90"
            >
              <Icon name="externalLink" className="h-4 w-4" />
              Buka halaman login
            </a>
          )}

          {needsCode && (
            <div className="flex gap-2">
              <input
                type="text"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCode()}
                placeholder="Tempel kode dari halaman login…"
                className="focus-ring flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
              />
              <button
                type="button"
                onClick={submitCode}
                className="focus-ring rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90"
              >
                Kirim
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={cancel}
            className="focus-ring rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
          >
            Batalkan
          </button>
        </div>
      )}

      {result && (
        <div
          className={`mt-4 flex items-center gap-2 text-sm ${
            result.ok === true ? "text-success" : result.ok === false ? "text-error" : "text-on-surface-variant"
          }`}
        >
          <Icon name={result.ok === true ? "check" : "close"} className="h-4 w-4" />
          {result.message}
          {result.ok === false && (
            <button type="button" onClick={start} className="focus-ring ml-1 font-semibold underline">
              Coba lagi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
