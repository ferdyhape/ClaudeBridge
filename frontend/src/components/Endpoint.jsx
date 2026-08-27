const methodStyles = {
  GET: "bg-secondary-container text-on-secondary-container",
  POST: "bg-primary-container text-on-primary-container",
  DELETE: "bg-error-container text-on-error-container",
};

export default function Endpoint({ method, path, title, children }) {
  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant/20 px-5 py-4">
        <span className={`rounded-md px-2 py-1 font-mono text-xs font-bold ${methodStyles[method]}`}>{method}</span>
        <code className="font-mono text-sm text-on-surface">{path}</code>
        {title && <span className="text-sm text-on-surface-variant">— {title}</span>}
      </div>
      <div className="space-y-4 px-5 py-5">{children}</div>
    </section>
  );
}
