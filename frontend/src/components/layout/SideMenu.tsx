import "./layout.css";

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  onNav: (page: "home" | "cart" | "checkout" | "admin") => void;
  /** Пункт «Админка» только для Telegram ID из ADMIN_IDS на сервере. */
  showAdminLink?: boolean;
};

export default function SideMenu({
  open,
  onClose,
  onNav,
  showAdminLink = false,
}: SideMenuProps) {
  return (
    <>
      <div
        className={`overlay${open ? " active" : ""}`}
        onClick={onClose}
      />
      <nav className={`side-menu${open ? " open" : ""}`}>
        <button onClick={() => onNav("home")}>Главная</button>
        <button onClick={() => onNav("cart")}>Корзина</button>
        <button onClick={() => onNav("checkout")}>Оформление</button>
        {showAdminLink && (
          <button type="button" onClick={() => onNav("admin")}>
            Админка
          </button>
        )}
      </nav>
    </>
  );
}