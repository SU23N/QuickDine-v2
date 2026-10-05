import { useEffect, useState } from "react";
import Nav from "../components/Nav";
import OrderCard from "../components/OrderCard";
import KitchenTicket from "../components/KitchenTicket";
import { useSession } from "../hooks/useSession";
import { useOrders } from "../hooks/useOrders";
import { useLanguage } from "../lib/i18n";
export default function Kitchen() {
  const { staff, user } = useSession(),
    { orders, loading, error } = useOrders(user?.uid, true),
    { t } = useLanguage();
  const [filter, setFilter] = useState("active"),
    [ticket, setTicket] = useState(null);
  useEffect(() => {
    if (ticket) window.print();
  }, [ticket]);
  const visible = orders
    .filter((o) =>
      filter === "active"
        ? ["new", "preparing", "ready"].includes(o.status)
        : o.status === filter,
    )
    .sort(
      (a, b) =>
        (a.scheduledAt?.toMillis() || a.createdAt?.toMillis() || 0) -
        (b.scheduledAt?.toMillis() || b.createdAt?.toMillis() || 0),
    );
  return (
    <>
      <div className="screen-content">
        <Nav />
        <main className="dashboard-page">
          <div className="dashboard-head">
            <h1>{t("kitchen")}</h1>
            <span>{staff.role === "waiter" ? t("waiter") : t("kitchen")}</span>
          </div>
          <div className="category-strip">
            <button
              className={filter === "active" ? "active" : ""}
              onClick={() => setFilter("active")}
            >
              {t("active")}
            </button>
            {["new", "preparing", "ready", "completed", "cancelled"].map(
              (s) => (
                <button
                  className={filter === s ? "active" : ""}
                  key={s}
                  onClick={() => setFilter(s)}
                >
                  {t(s)}
                </button>
              ),
            )}
          </div>
          {loading && <p>{t("loading")}</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!loading && !visible.length && <p>{t("noOrders")}</p>}
          <div className="order-grid">
            {visible.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                role={staff.role}
                onPrint={(order) => setTicket({ ...order })}
              />
            ))}
          </div>
        </main>
      </div>
      <KitchenTicket order={ticket} />
    </>
  );
}
