import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAdminPanelVisible } from "@/utils/admin";
import { getTelegramUser } from "../../utils/telegram";
import {
  telegramDisplayInitial,
  telegramDisplayName,
} from "../../utils/telegramUserMark";
import "./bars-shell.css";

const SUPPORT_BOT_URL = "https://t.me/coffee_market_test_bot";

type AppNavPage = "home" | "cart" | "checkout" | "admin" | "faq" | "my-orders";

type AdminSection = "orders" | "products" | "analytics" | "settings";

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  currentPage: AppNavPage;
  onNavToHome: () => void;
  onNavToMyOrders: () => void;
  onNavToFaq: () => void;
  onNavToAdmin: (section: AdminSection) => void;
};

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function readHash(): string {
  return window.location.hash;
}

function activeAdminSection(hash: string): AdminSection | null {
  if (!hash.includes("/admin")) return null;
  if (hash.includes("/analytics")) return "analytics";
  if (hash.includes("/settings")) return "settings";
  if (hash.includes("/products")) return "products";
  if (hash.includes("/orders")) return "orders";
  return "orders";
}

const ADMIN_LINKS: {
  section: AdminSection;
  hash: string;
  icon: string;
  label: string;
}[] = [
  { section: "orders", hash: "#/admin/orders", icon: "🗂️", label: "Заказы" },
  { section: "products", hash: "#/admin/products", icon: "🏷️", label: "Товары" },
  { section: "analytics", hash: "#/admin/analytics", icon: "📊", label: "Аналитика" },
  { section: "settings", hash: "#/admin/settings", icon: "⚙", label: "Настройки" },
];

export default function SideMenu({
  open,
  onClose,
  currentPage,
  onNavToHome,
  onNavToMyOrders,
  onNavToFaq,
  onNavToAdmin,
}: SideMenuProps) {
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const user = useMemo(() => getTelegramUser(), []);
  const admin = useAdminPanelVisible();
  const adminActive = activeAdminSection(hash);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const homeActive = currentPage === "home";
  const myOrdersActive = currentPage === "my-orders";
  const faqActive = currentPage === "faq";

  const openSupport = () => {
    window.open(SUPPORT_BOT_URL, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bars-overlay"
            className="bars-overlay"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onClick={onClose}
          />
          <motion.aside
            key="bars-drawer"
            className="bars-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            drag="x"
            dragConstraints={{ left: -130, right: 0 }}
            dragElastic={0.06}
            onDragEnd={(_, info) => {
              if (info.offset.x < -48 || info.velocity.x < -400) {
                onClose();
              }
            }}
          >
            <div className="bars-drawer__pull" aria-hidden />
            <div className="bars-drawer__scroll">
              <div className="bars-drawer__brand">
                <button
                  type="button"
                  className="bars-drawer__brand-btn"
                  onClick={() => {
                    onNavToHome();
                    onClose();
                  }}
                >
                  <div className="bars-drawer__brand-title">BARŚ</div>
                  <div className="bars-drawer__brand-tag">одежда</div>
                </button>
              </div>

              <nav className="bars-drawer__nav" aria-label="Разделы">
                <button
                  type="button"
                  className={`bars-drawer__link${myOrdersActive ? " bars-drawer__link--active" : ""}`}
                  onClick={() => {
                    onNavToMyOrders();
                    onClose();
                  }}
                >
                  <span className="bars-drawer__link-icon" aria-hidden>
                    📦
                  </span>
                  Мои заказы
                </button>

                <button
                  type="button"
                  className={`bars-drawer__link${homeActive ? " bars-drawer__link--active" : ""}`}
                  onClick={() => {
                    onNavToHome();
                    onClose();
                  }}
                >
                  <span className="bars-drawer__link-icon" aria-hidden>
                    🛍
                  </span>
                  Магазин
                </button>

                {admin && (
                  <>
                    <div className="bars-drawer__divider" aria-hidden />
                    {ADMIN_LINKS.map(({ section, icon, label }) => {
                      const isActive =
                        currentPage === "admin" && adminActive === section;
                      return (
                        <button
                          key={section}
                          type="button"
                          className={`bars-drawer__link${isActive ? " bars-drawer__link--active" : ""}`}
                          onClick={() => {
                            onNavToAdmin(section);
                            onClose();
                          }}
                        >
                          <span className="bars-drawer__link-icon" aria-hidden>
                            {icon}
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </>
                )}

                <div className="bars-drawer__divider" aria-hidden />

                <button
                  type="button"
                  className={`bars-drawer__link${faqActive ? " bars-drawer__link--active" : ""}`}
                  onClick={() => {
                    onNavToFaq();
                    onClose();
                  }}
                >
                  <span className="bars-drawer__link-icon" aria-hidden>
                    ❓
                  </span>
                  FAQ
                </button>

                <button type="button" className="bars-drawer__link" onClick={openSupport}>
                  <span className="bars-drawer__link-icon" aria-hidden>
                    💬
                  </span>
                  Поддержка
                </button>
              </nav>
            </div>

            <div className="bars-drawer__footer">
              <div className="bars-drawer__user">
                <div className="bars-drawer__user-avatar" aria-hidden>
                  {user?.photo_url ? (
                    <img src={user.photo_url} alt="" width={44} height={44} />
                  ) : (
                    telegramDisplayInitial(user)
                  )}
                </div>
                <div className="bars-drawer__user-meta">
                  <div className="bars-drawer__user-name">
                    {telegramDisplayName(user)}
                  </div>
                  {user?.username ? (
                    <div className="bars-drawer__user-handle">@{user.username}</div>
                  ) : (
                    <div className="bars-drawer__user-handle">Telegram</div>
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
