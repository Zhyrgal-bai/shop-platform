import "./layout.css";

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  onNav: (page: "home" | "cart" | "checkout" | "admin") => void;
};

export default function SideMenu({ open, onClose, onNav }: SideMenuProps) {
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
        <button onClick={() => onNav("admin")}>Админка</button>
      </nav>
    </>
  );
}