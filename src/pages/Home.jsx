import FoodVisual from "../components/FoodVisual";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import { useLanguage } from "../lib/i18n";
export default function Home() {
  const { t } = useLanguage();
  return (
    <>
      <Nav />
      <main>
        <section className="hero premium">
          <div className="hero-copy">
            <span className="eyebrow">
              QuickDine • Yash Family ReStra & Dhaba
            </span>
            <h1>{t("homeTitle")}</h1>
            <p>{t("homeBody")}</p>
            <div className="hero-actions">
              <Link className="primary" to="/customer">
                {t("browse")}
              </Link>
              <Link className="secondary" to="/customer?mode=advance-dine-in">
                {t("advance")}
              </Link>
            </div>
            <p>{t("note")}</p>
          </div>
          <div className="hero-art">
            <div className="plate">
              <FoodVisual
                item={{
                  id: "home",
                  name: "Fresh food",
                  nameHi: "ताज़ा भोजन",
                  category: "Main Course",
                }}
              />
            </div>
            <div className="floating-card card-one">{t("menu")}</div>
            <div className="floating-card card-two">{t("takeawayMode")}</div>
          </div>
        </section>
      </main>
    </>
  );
}
