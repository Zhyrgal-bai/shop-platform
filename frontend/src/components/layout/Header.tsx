import { useMemo } from "react";
import { motion } from "framer-motion";
import { getTelegramUser } from "../../utils/telegram";
import { telegramDisplayInitial } from "../../utils/telegramUserMark";
import "./bars-shell.css";

type HeaderProps = {
  menuOpen?: boolean;
  onMenuToggle?: () => void;
};

export default function Header({ menuOpen = false, onMenuToggle }: HeaderProps) {
  const user = useMemo(() => getTelegramUser(), []);
  const initial = telegramDisplayInitial(user);

  return (
    <header className="bars-header">
      <div className="bars-header__cell bars-header__cell--left">
        <motion.button
          type="button"
          className={`bars-header__burger${menuOpen ? " bars-header__burger--open" : ""}`}
          onClick={onMenuToggle}
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          whileTap={{ scale: 0.94 }}
        >
          <span className="bars-header__burger-line" />
          <span className="bars-header__burger-line" />
          <span className="bars-header__burger-line" />
        </motion.button>
      </div>

      <h1 className="bars-header__logo">BARŚ</h1>

      <div className="bars-header__cell bars-header__cell--right">
        <div
          className="bars-header__mark"
          aria-hidden
          title={user?.first_name?.trim() || user?.username || undefined}
        >
          {user?.photo_url ? (
            <img src={user.photo_url} alt="" width={40} height={40} />
          ) : (
            initial
          )}
        </div>
      </div>
    </header>
  );
}
