import { useState } from "react";
import Icon from "./Icon";

export default function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; the code is still selectable by hand */
    }
  };

  return (
    <div className="rounded-lg bg-inverse-surface">
      {label && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-inverse-on-surface/50">{label}</span>
          <button
            type="button"
            onClick={copy}
            className="focus-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-inverse-on-surface/70 hover:bg-white/10 hover:text-inverse-on-surface"
          >
            <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
            {copied ? "Disalin" : "Salin"}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-inverse-on-surface">
        <code>{code}</code>
      </pre>
    </div>
  );
}
