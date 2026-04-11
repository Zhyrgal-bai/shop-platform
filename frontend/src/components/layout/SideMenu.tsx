import "./layout.css";
import { isAdminPanelVisible } from "@/utils/admin";

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  onNav: (page: "home" | "cart" | "checkout" | "admin" | "faq") => void;
};

export default function SideMenu({
  open,
  onClose,
  onNav,
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
        {isAdminPanelVisible() && (
          <button type="button" onClick={() => onNav("admin")}>
            Админ панель
          </button>
        )}
      </nav>
    </>
  );
}