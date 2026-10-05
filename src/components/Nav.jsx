import { NavLink, Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useLanguage } from "../lib/i18n";
import { useSession } from "../hooks/useSession";
import { auth } from "../firebase/config";
export default function Nav({ cartCount = 0, onCartClick }) {
  const { lang, setLang, t } = useLanguage(),
    { staff, user } = useSession(),
    location = useLocation();
  const customerLink =
    location.pathname === "/customer"
      ? `${location.pathname}${location.search}`
      : "/customer";
  return (
    <header className="topbar">
      <div className="nav-shell">
        <Link className="brand" to="/">
          <span className="brand-mark">Q</span>
          <span>
            <strong>QuickDine</strong>
            <small>Yash Family ReStra & Dhaba</small>
          </span>
        </Link>
        <nav className="desktop-nav">
          <NavLink to={customerLink}>{t("menu")}</NavLink>
          {staff && <NavLink to="/kitchen">{t("kitchen")}</NavLink>}
          {staff?.role === "owner" && (
            <>
              <NavLink to="/owner">{t("owner")}</NavLink>
              <NavLink to="/admin">{t("admin")}</NavLink>
            </>
          )}
          {!staff && <NavLink to="/login">{t("login")}</NavLink>}
        </nav>
        <div className="nav-actions">
          <button
            className="language-button"
            aria-label="Switch language"
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
          >
            {lang === "en" ? "हिन्दी" : "English"}
          </button>
          {user && !user.isAnonymous && (
            <button className="language-button" onClick={() => signOut(auth)}>
              {t("logout")}
            </button>
          )}
          {onCartClick && (
            <button className="cart-button" onClick={onCartClick}>
              {t("cart")} <span>{cartCount}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
