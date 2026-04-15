import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/admin/orders", label: "Заказы", icon: "📦" },
  { to: "/admin/products", label: "Товары", icon: "➕" },
  { to: "/admin/products/manage", label: "Каталог", icon: "🛍️" },
  { to: "/admin/analytics", label: "Аналитика", icon: "📊" },
  { to: "/admin/settings", label: "Настройки", icon: "⚙️" },
] as const;

type AdminLayoutProps = {
  onExit: () => void;
};

export default function AdminLayout({ onExit }: AdminLayoutProps) {
  return (
    <div className="admin-dash">
      <aside className="admin-dash__sidebar">
        <div className="admin-dash__brand">
          <span className="admin-dash__brand-title">Админ</span>
          <button
            type="button"
            className="admin-dash__exit"
            onClick={onExit}
          >
            ← В магазин
          </button>
        </div>
        <nav className="admin-dash__nav" aria-label="Админ-разделы">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `admin-dash__nav-link${isActive ? " admin-dash__nav-link--active" : ""}`
              }
              end={to === "/admin/products"}
            >
              <span className="admin-dash__nav-icon" aria-hidden>
                {icon}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="admin-dash__main">
        <Outlet />
      </main>
    </div>
  );
}
