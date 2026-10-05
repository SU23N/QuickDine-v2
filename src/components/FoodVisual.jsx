import { label, useLanguage } from "../lib/i18n";
export default function FoodVisual({ item }) {
  const { lang } = useLanguage();
  const drink = item.category === "Drinks",
    bread = item.category === "Breads",
    dessert = item.category === "Desserts";
  return (
    <svg
      viewBox="0 0 100 100"
      className="dish-illustration"
      role="img"
      aria-label={label(item, "name", lang)}
    >
      <ellipse cx="50" cy="83" rx="34" ry="7" fill="#773f2218" />
      {drink ? (
        <>
          <path
            d="M31 22h38l-5 58H36z"
            fill="#b97845"
            stroke="#5c301c"
            strokeWidth="3"
          />
          <path
            d="M57 9h7L52 63"
            fill="none"
            stroke="#7f1d1d"
            strokeWidth="4"
          />
          <path d="M33 30h34" stroke="#fff2d4" strokeWidth="7" />
          <circle cx="43" cy="42" r="4" fill="#f4d5b0" />
        </>
      ) : (
        <>
          <ellipse
            cx="50"
            cy="68"
            rx="40"
            ry="18"
            fill="#fff8ed"
            stroke="#dfc6ac"
            strokeWidth="2"
          />
          {bread ? (
            <>
              <ellipse
                cx="50"
                cy="54"
                rx="27"
                ry="21"
                transform="rotate(-12 50 54)"
                fill="#efc274"
              />
              <path
                d="M33 48l6 3m14-11l5 2m-12 18l4 3m10-9l5 2"
                stroke="#a86930"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </>
          ) : dessert ? (
            <>
              <circle cx="37" cy="59" r="13" fill="#aa4d25" />
              <circle cx="63" cy="59" r="13" fill="#974020" />
              <circle cx="50" cy="39" r="13" fill="#bc6330" />
              <path
                d="M33 52l5-3m11-17l5-1m5 53l4-4"
                stroke="#edb467"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M19 51h62c-2 21-13 29-31 29S21 72 19 51"
                fill="#faf1e5"
                stroke="#d7b596"
                strokeWidth="2"
              />
              <ellipse
                cx="50"
                cy="51"
                rx="31"
                ry="13"
                fill={item.category === "Rice" ? "#f5dc9a" : "#de923c"}
              />
              <rect
                x="30"
                y="43"
                width="10"
                height="10"
                rx="2"
                fill="#fff0c8"
                transform="rotate(-12 35 48)"
              />
              <rect
                x="52"
                y="50"
                width="12"
                height="10"
                rx="2"
                fill="#fff0c8"
                transform="rotate(12 58 55)"
              />
              <path
                d="M45 43q9-12 17-3q-9 10-17 3m-4 16q-10-10-15-2q7 8 15 2"
                fill="#4b8245"
              />
              <path
                d="M37 27q-5-6 0-12m15 12q-5-6 0-12m14 12q-5-6 0-12"
                fill="none"
                stroke="#cba987"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </>
          )}
        </>
      )}
    </svg>
  );
}
