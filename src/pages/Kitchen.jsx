import { useEffect, useState } from "react";
import RestaurantFrame from "../components/RestaurantFrame";
import Icon from "../components/Icon";
import OrderCard from "../components/OrderCard";
import KitchenTicket from "../components/KitchenTicket";
import { useSession } from "../hooks/useSession";
import { useOrders } from "../hooks/useOrders";
import { useLanguage } from "../lib/i18n";
export default function Kitchen({view='kitchen'}) {
  const { staff, user } = useSession(),
    { orders, loading, error } = useOrders(user?.uid, true),
    { t } = useLanguage();
  const waiter=view==='waiter';
  const [filter, setFilter] = useState(waiter?'ready':"active"),
    [ticket, setTicket] = useState(null);
  useEffect(()=>{setFilter(waiter?'ready':'active');setTicket(null);},[waiter]);
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
        <RestaurantFrame title={waiter?t('waiter'):t('kitchen')} section={waiter?'Waiter':'Kitchen'} subtitle={waiter?'Ready dishes, table numbers and service updates in one place.':'Accept orders, prepare dishes and mark them ready for service.'}>
          <div className="queue-summary">{['new','preparing','ready'].map(status=><button key={status} className={`queue-stat stage-${status} ${filter===status?'selected':''}`} onClick={()=>setFilter(status)}><Icon name={status==='new'?'receipt':status==='preparing'?'chef':'bell'}/><strong>{orders.filter(o=>o.status===status).length}</strong><span>{t(status)}</span></button>)}</div>
          <div className="category-strip queue-filters">
            <button
              className={filter === "active" ? "active" : ""}
              aria-pressed={filter==='active'}
              onClick={() => setFilter("active")}
            >
              {t("active")}
            </button>
            {["new", "preparing", "ready", "completed", "cancelled"].map(
              (s) => (
                <button
                  className={filter === s ? "active" : ""}
                  aria-pressed={filter===s}
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
          {!loading && !visible.length && <div className="saas-empty"><Icon name={waiter?'bell':'chef'} size={36}/><h3>{t('noOrders')}</h3><p>{waiter?'New ready orders will appear here for collection or table service.':'Your queue is clear. New orders will appear here.'}</p></div>}
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
        </RestaurantFrame>
      </div>
      <KitchenTicket order={ticket} />
    </>
  );
}
