import { useLanguage, label, formatTime } from "../lib/i18n";
export default function KitchenTicket({ order }) {
  const { lang, t } = useLanguage();
  if (!order) return null;
  return (
    <div className="kitchen-ticket">
      <h1>QuickDine • Kitchen</h1>
      <h2>#{order.id.slice(0, 8)}</h2>
      <p>
        {order.mode === "table"
          ? `${t("table")} ${order.tableId}`
          : t(order.mode === "takeaway" ? "takeawayMode" : "advanceMode")}
      </p>
      <p>
        {t("created")}: {formatTime(order.createdAt, lang)}
      </p>
      {order.scheduledAt && (
        <p>
          {t("due")}: {formatTime(order.scheduledAt, lang)}
        </p>
      )}
      <ul>
        {order.items.map((i) => (
          <li key={i.id}>
            {i.qty} × {label(i, "name", lang)}
          </li>
        ))}
      </ul>
      {order.instructions && (
        <p>
          <strong>
            {t("instructions")}: {order.instructions}
          </strong>
        </p>
      )}
      <p>
        {t("status")}: {t(order.status)}
      </p>
    </div>
  );
}
