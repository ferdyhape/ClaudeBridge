const variants = {
  success: "bg-success-container text-on-success-container",
  error: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container-high text-on-surface-variant",
};

const dots = {
  success: "bg-success",
  error: "bg-error",
  neutral: "bg-outline",
};

export default function Badge({ variant = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[13px] font-medium ${variants[variant]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[variant]}`} />
      {children}
    </span>
  );
}
