import "./layout.css";

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  onNav: (page: "home" | "cart" | "checkout" | "admin" | "faq") => void;
  /** Пункт «Админ панель»: когда в App передан `isAdmin` (сейчас DEBUG: всегда true). */
  isAdmin?: boolean;
};

export default function SideMenu({
  open,
  onClose,
  onNav,
  isAdmin = false,
}: SideMenuProps) {
  return (
    <>
      <div
        className={`overlay${open ? " active" : ""}`}
        onClick={onClose}
      />
      <nav className={`side-menu${open ? " open" : ""}`}>
        <button onClick={() => onNav("home")}>Главная</button>
        <button type="button" onClick={() => onNav("faq")}>
          FAQ / О нас
        </button>
        <button onClick={() => onNav("cart")}>Корзина</button>
        <button onClick={() => onNav("checkout")}>Оформление</button>
        {isAdmin && (
          <button type="button" onClick={() => onNav("admin")}>
            Админ панель
          </button>
        )}
      </nav>
    </>
  );
}