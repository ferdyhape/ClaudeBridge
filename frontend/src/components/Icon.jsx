const paths = {
  key: "M15 7a4 4 0 1 0-3.9 5H9v3H6v3H3v-3.17a2 2 0 0 1 .59-1.42L11.1 6.9A4 4 0 0 1 15 7zM16.5 6.5h.01",
  book: "M4 5.5C4 4.67 4.67 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13zM20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13z",
  copy: "M9 9h10v10H9V9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12",
  check: "m5 13 4 4L19 7",
  close: "M6 6l12 12M18 6 6 18",
  chevronRight: "m9 6 6 6-6 6",
  externalLink: "M14 5h5v5M9 15 19 5M6 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-1",
  refresh: "M4 4v5h5M20 20v-5h-5M4.5 9a7.5 7.5 0 0 1 13-4.5L20 7M19.5 15a7.5 7.5 0 0 1-13 4.5L4 17",
  logout: "M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9",
  terminal: "m5 7 5 5-5 5M12 19h7",
  sparkle: "M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2",
  server: "M4 4h16v6H4V4zm0 10h16v6H4v-6zM7.5 7h.01M7.5 17h.01",
};

export default function Icon({ name, className = "w-5 h-5", strokeWidth = 1.75 }) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
