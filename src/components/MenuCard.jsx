import FoodVisual from "./FoodVisual";
import { label, money, useLanguage } from "../lib/i18n";
export default function MenuCard({ item, onAdd, locked = false }) {
  const { lang, t } = useLanguage();
  return (
    <article className="menu-card">
      <div className="food-visual">
        <FoodVisual item={item} />
        <div
          className={item.veg ? "food-dot veg" : "food-dot nonveg"}
          aria-label={item.veg ? "Vegetarian" : "Non-vegetarian"}
        />
      </div>
      <div className="menu-card-body">
        <div className="menu-meta">
          <span>{label(item, "category", lang)}</span>
        </div>
        <h3>{label(item, "name", lang)}</h3>
        <p>{label(item, "description", lang)}</p>
        <div className="menu-card-footer">
          <strong>{money(item.pricePaise)}</strong>
          <button
            disabled={!item.available || locked}
            onClick={() => onAdd(item)}
          >
            {item.available ? `${t("add")} +` : t("unavailable")}
          </button>
        </div>
      </div>
    </article>
  );
}
