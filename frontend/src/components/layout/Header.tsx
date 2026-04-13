import { useMemo } from "react";
import { getTelegramUser } from "../../utils/telegram";
import "./layout.css";

type HeaderProps = {
  onMenuToggle?: () => void;
};

function UserAvatarPlaceholder() {
  return (
    <span className="header__user-avatar header__user-avatar--placeholder" aria-hidden>
      <svg
        className="header__user-avatar-icon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.33 0-6 1.67-6 3.75V20h12v-2.25C18 15.67 15.33 14 12 14Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    </span>
  );
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const user = useMemo(() => getTelegramUser(), []);

  const displayName =
    user?.first_name?.trim() ||
    (user?.username ? `@${user.username}` : null) ||
    "Гость";

  return (
    <header className="header">
      <div className="header__cell header__cell--left">
        <div className="header__burger" onClick={onMenuToggle}>
          <span className="header__burger-line" />
          <span className="header__burger-line" />
          <span className="header__burger-line" />
        </div>
      </div>

      <div className="header__title">BARS</div>

      <div className="header__cell header__cell--right">
        {user ? (
          <div className="header__user" aria-label="Профиль Telegram">
            {user.photo_url ? (
              <img
                src={user.photo_url}
                alt=""
                className="header__user-avatar"
                width={32}
                height={32}
              />
            ) : (
              <UserAvatarPlaceholder />
            )}
            <div className="header__user-meta">
              <div className="header__user-name">{displayName}</div>
              {user.username ? (
                <div className="header__user-handle">@{user.username}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
