import FoodVisual from "../components/FoodVisual";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import { useLanguage } from "../lib/i18n";
import { useTenant } from "../hooks/useTenant";
import { useRecord } from "../hooks/useSaas";
export default function Home() {
  const { t, lang } = useLanguage();
  const { restaurantId, path } = useTenant();
  const { record: restaurant } = useRecord(`restaurants/${restaurantId}`);
  return (
    <>
      <Nav />
      <main>
        <section className="hero premium">
          <div className="hero-copy">
            <span className="eyebrow">
              QuickDine • {lang === "hi" && restaurant?.nameHi ? restaurant.nameHi : restaurant?.name || restaurantId}
            </span>
            <h1>{t("homeTitle")}</h1>
            <p>{t("homeBody")}</p>
            <div className="hero-actions">
              <Link className="primary" to={path("customer")}>
                {t("browse")}
              </Link>
              <Link className="secondary" to={path("customer") + "?mode=advance-dine-in"}>
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
