import { useState } from "react";
import { useLanguage, label, money, formatTime } from "../lib/i18n";
import { changeOrder } from "../lib/orders";
import { canTransition } from "../../functions/domain";
export default function OrderCard({ order, role, onPrint }) {
  const { lang, t } = useLanguage(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function action(changes) {
    setBusy(true);
    setError("");
    try {
      await changeOrder(order.id, changes);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const next = {
    new: ["preparing", "accept"],
    preparing: ["ready", "markReady"],
    ready: ["completed", "complete"],
  }[order.status];
  return (
    <article className="order-card">
      <div className="order-top">
        <strong>#{order.id.slice(0, 8)}</strong>
        <span>
          {order.mode === "table"
            ? `${t("table")} ${order.tableId}`
            : t(order.mode === "takeaway" ? "takeawayMode" : "advanceMode")}
        </span>
      </div>
      <p className={`order-status status-${order.status}`}>
        {t("status")}: {t(order.status)}
      </p>
      <ul>
        {order.items.map((i) => (
          <li key={i.id}>
            <strong>
              {i.qty} × {label(i, "name", lang)}
            </strong>
          </li>
        ))}
      </ul>
      {order.instructions && (
        <p className="order-instructions">
          {t("instructions")}: {order.instructions}
        </p>
      )}
      {order.customer && (
        <p>
          {order.customer.name}
          {role && ` • ${order.customer.phone}`}
        </p>
      )}
      {order.scheduledAt && (
        <p>
          {t("due")}: {formatTime(order.scheduledAt, lang)}
        </p>
      )}
      <p>
        {t("amount")}: {money(order.totalPaise)} • {t(order.paymentStatus)}
      </p>
      <small>
        {t("created")}: {formatTime(order.createdAt, lang)}
      </small>
      {role && <p>{t(order.source)}</p>}
      <div className="order-actions">
        {next && canTransition(role, order.status, next[0]) && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => action({ status: next[0] })}
          >
            {t(next[1])}
          </button>
        )}
        {role === "owner" &&
          ["new", "preparing", "ready"].includes(order.status) &&
          order.paymentStatus !== "paid" && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`${t("cancel")} #${order.id.slice(0, 8)}?`))
                  action({ status: "cancelled" });
              }}
            >
              {t("cancel")}
            </button>
          )}
        {role === "owner" &&
          order.status !== "cancelled" &&
          order.paymentStatus !== "paid" && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(`${t("markPaid")} ${money(order.totalPaise)}?`)
                )
                  action({ action: "mark-paid" });
              }}
            >
              {t("markPaid")}
            </button>
          )}
        {onPrint && (
          <button className="secondary" onClick={() => onPrint(order)}>
            {t("print")}
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
