import { NavLink, Outlet } from "react-router-dom";
import Icon from "../components/Icon";

const navLinkClass = ({ isActive }) =>
  `focus-ring flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-primary-container text-on-primary-container"
      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
  }`;

export default function AppShell() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary">
              <Icon name="sparkle" className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </span>
            <span className="font-display text-[15px] font-semibold text-on-surface">Claude Sub-Machine</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              <Icon name="key" className="h-4 w-4" />
              Akun
            </NavLink>
            <NavLink to="/docs" className={navLinkClass}>
              <Icon name="book" className="h-4 w-4" />
              Dokumentasi
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
