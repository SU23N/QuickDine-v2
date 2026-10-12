import {useTenant} from "../hooks/useTenant";
import {useRecord} from "../hooks/useSaas";
import {useEffect} from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useLanguage } from "../lib/i18n";
import { useSession } from "../hooks/useSession";
import { auth } from "../firebase/config";
export default function Nav({ cartCount = 0, onCartClick }) {
  const {restaurantId,path}=useTenant();
  const {record:restaurant}=useRecord(`restaurants/${restaurantId}`);
  useEffect(()=>{const c=restaurant?.accentColor||"#7f1d1d";document.documentElement.style.setProperty("--wine",c);const rgb=c.slice(1).match(/.{2}/g).map(x=>parseInt(x,16));document.documentElement.style.setProperty("--brand-contrast",rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>160?"#24302c":"#ffffff");},[restaurant?.accentColor]);
  const { lang, setLang, t } = useLanguage(),
    { staff, user,platformAdmin } = useSession(),
    location = useLocation();
  const customerLink =
    location.pathname.endsWith("/customer")
      ? `${location.pathname}${location.search}`
      : path("customer");
  return (
    <header className="topbar">
      <div className="nav-shell">
        <Link className="brand" to={`/r/${restaurantId}`}>
          {restaurant?.logoUrl ? <img className="brand-mark restaurant-logo" src={restaurant.logoUrl} alt={restaurant.name + " logo"} onError={e=>{e.currentTarget.style.visibility='hidden';}}/> : <span className="brand-mark">Q</span>}
          <span>
            <strong>QuickDine</strong>
            <small>{restaurant?.name||restaurantId}</small>
          </span>
        </Link>
        <nav className="desktop-nav">
          <NavLink to={customerLink}>{t("menu")}</NavLink>
          {staff && <NavLink to={path("kitchen")}>{t("kitchen")}</NavLink>}
          {staff?.role === "owner" && (
            <>
              <NavLink to={path("owner")}>{t("owner")}</NavLink>
              <NavLink to={path("admin")}>{t("admin")}</NavLink>
            </>
          )}
          {staff?.role === "owner"&&<NavLink to={path("settings")}>Brand & team</NavLink>}
          {staff?.role === "owner"&&<NavLink to={path("billing")}>Subscription</NavLink>}
          {platformAdmin&&<NavLink to="/console">Platform</NavLink>}
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
