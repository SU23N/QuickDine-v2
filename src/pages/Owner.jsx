import Nav from "../components/Nav";
import OrderCard from "../components/OrderCard";
import { useSession } from "../hooks/useSession";
import { useOrders } from "../hooks/useOrders";
import { useLanguage, money } from "../lib/i18n";
import { paidSales } from "../../functions/domain";
function indiaDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export default function Owner() {
  const { user } = useSession(),
    { orders, loading, error } = useOrders(user?.uid, true),
    { t } = useLanguage();
  const today = indiaDate(new Date());
  const placed = orders.filter(
    (o) => o.createdAt && indiaDate(o.createdAt.toDate()) === today,
  );
  const paidToday = orders.filter(
    (o) =>
      o.paidAt &&
      indiaDate(o.paidAt.toDate()) === today &&
      o.paymentStatus === "paid" &&
      o.status !== "cancelled",
  );
  const sales = paidSales(paidToday),
    active = orders.filter((o) =>
      ["new", "preparing", "ready"].includes(o.status),
    ).length;
  return (
    <>
      <Nav />
      <main className="dashboard-page">
        <div className="dashboard-head">
          <h1>{t("overview")}</h1>
          <span>IST • {today}</span>
        </div>
        {loading && <p>{t("loading")}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="stats">
          <Stat title={t("sales")} value={money(sales)} />
          <Stat title={t("orders")} value={placed.length} />
          <Stat title={t("active")} value={active} />
          <Stat
            title={t("average")}
            value={money(
              paidToday.length ? Math.round(sales / paidToday.length) : 0,
            )}
          />
        </div>
        <h2>{t("yourOrders")}</h2>
        <div className="order-grid">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} role="owner" />
          ))}
        </div>
      </main>
    </>
  );
}
function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
