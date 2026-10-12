import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Nav from "../components/Nav";
import Icon from "../components/Icon";
import MenuCard from "../components/MenuCard";
import CartDrawer from "../components/CartDrawer";
import OrderCard from "../components/OrderCard";
import { useRestaurant } from "../hooks/useRestaurant";
import { useSession } from "../hooks/useSession";
import { useOrders } from "../hooks/useOrders";
import { useLanguage, label, money } from "../lib/i18n";
import { readStored, writeStored } from "../lib/storage";
import { sendOrder } from "../lib/orders";
import { withinServiceHours } from "../../functions/domain";
import {useTenant} from "../hooks/useTenant";
export default function Customer() {
  const [params, setParams] = useSearchParams();
  const {restaurantId}=useTenant();
  const table = params.get("table") || "",
    mode = params.get("mode") || "table";
  return (
    <CustomerContent
      key={`${restaurantId}:${table}:${mode}`}
      table={table}
      initialMode={mode}
      setParams={setParams}
    />
  );
}
import {millis} from "../../functions/saas-domain";
function CustomerContent({ table, initialMode, setParams }) {
  const {restaurantId}=useTenant();
  const { lang, t } = useLanguage(),
    { menu, restaurant, loading, error: menuError, isDemo } = useRestaurant(),
    { user, staff, ensureCustomer } = useSession();
  const onlineOpen=restaurant?.acceptingOrders===true && restaurant?.status!=="suspended" && restaurant?.serviceAccessState!=="paused" && (restaurant?.orderingAccessUntil==null||millis(restaurant.orderingAccessUntil)>Date.now());
  const key = `quickdine:${restaurantId}:${table || "advance"}:${initialMode}`;
  const saved = useMemo(() => readStored(key, {}), [key]);
  const [activeCategory, setActiveCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState(() =>
      Array.isArray(saved.cart)
        ? saved.cart
            .filter(
              (i) =>
                typeof i.id === "string" &&
                Number.isInteger(i.qty) &&
                i.qty > 0 &&
                i.qty <= 20,
            )
            .slice(0, 30)
        : [],
    ),
    [cartOpen, setCartOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    ...{
      mode: ["table", "advance-dine-in", "takeaway"].includes(initialMode)
        ? initialMode
        : "table",
      tableId: table,
      instructions: "",
      name: "",
      phone: "",
      time: "",
    },
    ...saved.form,
    tableId: table,
  }));
  const [busy, setBusy] = useState(false),
    [recovery, setRecovery] = useState(() => {
      const p = readStored(`${key}:pending`, null);
      return p?.payload && p?.requestId ? p : null;
    }),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(null),
    [waiterTable, setWaiterTable] = useState(table),
    submitLock = useRef(false);
  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
  } = useOrders(user?.uid);
  useEffect(() => {
    writeStored(key, { cart, form });
  }, [key, cart, form]);
  const categories = ["All", ...new Set(menu.map((i) => i.category))];
  const filtered = useMemo(
    () =>
      menu.filter(
        (i) =>
          (activeCategory === "All" || i.category === activeCategory) &&
          `${i.name} ${i.nameHi || ""}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()) &&
          (!vegOnly || i.veg),
      ),
    [menu, activeCategory, search, vegOnly],
  );
  const liveLines = cart.map((i) => {
    const dish = menu.find((d) => d.id === i.id);
    return {
      ...(dish || {
        id: i.id,
        name: "Unavailable dish",
        pricePaise: 0,
        available: false,
      }),
      qty: i.qty,
    };
  });
  const lines = recovery?.displayItems || liveLines;
  const count = cart.reduce((s, i) => s + i.qty, 0),
    total = lines.reduce((s, i) => s + i.qty * i.pricePaise, 0),
    unavailable = lines.some((i) => !i.available);
  function add(item) {
    if (recovery) return;
    setError("");
    setReceipt(null);
    setCart((c) => {
      const f = c.find((i) => i.id === item.id);
      if (f)
        return c.map((i) =>
          i.id === item.id ? { ...i, qty: Math.min(20, i.qty + 1) } : i,
        );
      return c.length < 30 ? [...c, { id: item.id, qty: 1 }] : c;
    });
  }
  function changeQty(id, delta) {
    if (recovery) return;
    setCart((c) =>
      c
        .map((i) =>
          i.id === id ? { ...i, qty: Math.min(20, i.qty + delta) } : i,
        )
        .filter((i) => i.qty > 0),
    );
  }
  function editForm(field, value) {
    if (recovery) return;
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setError("");
    try {
      if (
        !recovery &&
        (isDemo ||
          onlineOpen !== true ||
          unavailable ||
          !cart.length)
      )
        throw new Error(t("closed"));
      if (form.mode === "table" && !/^[1-9][0-9]{0,2}$/.test(form.tableId))
        throw new Error(t("tableMissing"));
      const customer = await ensureCustomer();
      if (recovery && recovery.uid !== customer.uid)
        throw Error(
          lang === "hi"
            ? "पिछले खाते से लॉगिन करके ऑर्डर की पुष्टि करें।"
            : "Sign in with the original account to recover this order.",
        );
      const payload = recovery?.payload || {
        mode: form.mode,
        tableId: form.mode === "table" ? form.tableId : null,
        instructions: form.instructions.trim(),
        items: cart.map((i) => ({ id: i.id, qty: i.qty })),
        expectedTotalPaise: total,
        scheduledAt:
          form.mode === "table" ? null : Date.parse(`${form.time}:00+05:30`),
        customer:
          form.mode === "table"
            ? null
            : { name: form.name.trim(), phone: form.phone.trim() },
      };
      const requestId = recovery?.requestId || crypto.randomUUID();
      const pending = {
        uid: customer.uid,
        payload,
        requestId,
        displayItems: lines,
      };
      writeStored(`${key}:pending`, pending);
      setRecovery(pending);
      const result = await sendOrder({ ...payload, requestId }, restaurantId);
      setReceipt(result);
      setCart([]);
      setForm((f) => ({ ...f, instructions: "" }));
      writeStored(`${key}:pending`, null);
      setRecovery(null);
      setCartOpen(false);
    } catch (e) {
      if (
        [
          "functions/invalid-argument",
          "functions/failed-precondition",
          "functions/resource-exhausted",
        ].includes(e.code)
      ) {
        writeStored(`${key}:pending`, null);
        setRecovery(null);
      }
      setError(e.message);
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Nav cartCount={count} onCartClick={() => setCartOpen(true)} />
      <main className="customer-page">
        <section className="menu-hero">
          <div>
            <span className="eyebrow light">
              {form.mode === "table"
                ? `${t("table")} ${table || "—"}`
                : t(form.mode === "takeaway" ? "takeawayMode" : "advanceMode")}
            </span>
            <h1>
              {lang === "hi"
                ? "आज क्या खाना चाहेंगे?"
                : "What would you like today?"}
            </h1>
            <p>
              {restaurant
                ? label(restaurant, "name", lang)
                : "Yash Family ReStra & Dhaba"}
            </p>
          </div>
          <div className="status-pill">
            {isDemo
              ? t("demo")
              : onlineOpen &&
                  withinServiceHours(
                    Date.now(),
                    restaurant.openingTime,
                    restaurant.closingTime,
                  )
                ? `${t("open")} • ${restaurant.openingTime}–${restaurant.closingTime} IST`
                : t("closed")}
          </div>
        </section>
        {staff?.role === "waiter" && (
          <form
            className="waiter-tools"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^[1-9][0-9]{0,2}$/.test(waiterTable))
                setParams({ table: waiterTable });
            }}
          >
            <label>
              {t("waiter")} • {t("table")}
              <input
                type="number"
                min="1"
                max="999"
                required
                value={waiterTable}
                onChange={(e) => setWaiterTable(e.target.value)}
              />
            </label>
            <button className="primary">{t("menu")}</button>
          </form>
        )}
        <section className="menu-tools">
          <div className="search-box">
            <Icon name="search"/>
            <input
              aria-label={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
            />
          </div>
          <label className="veg-toggle">
            <input
              type="checkbox"
              checked={vegOnly}
              onChange={(e) => setVegOnly(e.target.checked)}
            />
            {t("vegOnly")}
          </label>
        </section>
        <section className="category-strip">
          {categories.map((c) => (
            <button
              className={activeCategory === c ? "active" : ""}
              aria-pressed={activeCategory===c}
              key={c}
              onClick={() => setActiveCategory(c)}
            >
              {c === "All"
                ? t("all")
                : label(
                    menu.find((i) => i.category === c) || { category: c },
                    "category",
                    lang,
                  )}
            </button>
          ))}
        </section>
        <section className="section menu-section">
          {menuError && (
            <p className="error" role="alert">
              {t("menuError")} {menuError}
            </p>
          )}
          {loading ? (
            <p>{t("loading")}</p>
          ) : (
            <>
              <div className="menu-results"><h2>{activeCategory==='All'?(lang==='hi'?'हमारा मेन्यू':'On the menu'):label(menu.find(i=>i.category===activeCategory)||{category:activeCategory},'category',lang)}</h2><span>{filtered.length} {lang==='hi'?'व्यंजन':'dishes'}</span></div>
              <div className="menu-grid">
                {filtered.map((i) => (
                  <MenuCard
                    key={i.id}
                    item={i}
                    onAdd={add}
                    locked={Boolean(recovery)}
                  />
                ))}
              </div>
              {!filtered.length && <div className="saas-empty"><Icon name="search" size={30}/><h3>{t('noResults')}</h3><button className="table-action" onClick={()=>{setSearch('');setActiveCategory('All');setVegOnly(false);}}>{lang==='hi'?'फ़िल्टर हटाएँ':'Reset filters'}</button></div>}
            </>
          )}
          {receipt && (
            <div role="status" className="notice success">
              {t("confirm")} • #{receipt.id.slice(0, 8)} •{" "}
              {money(receipt.totalPaise)}
            </div>
          )}
          {error && !cartOpen && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {recovery && !busy && (
            <div className="notice" role="status">
              <p>
                {lang === "hi"
                  ? "पिछले ऑर्डर की पुष्टि बाकी है। उसी ऑर्डर को फिर भेजकर जाँचें।"
                  : "Your last submission needs confirmation. Retry the same order to recover its receipt."}
              </p>
              <button className="primary" onClick={() => setCartOpen(true)}>
                {t("retry")}
              </button>
            </div>
          )}
          <section className="recent-orders">
            <h2>{t("yourOrders")}</h2>
            <p>{t("recentHint")}</p>
            {ordersLoading && <p>{t("loading")}</p>}
            {ordersError && (
              <p className="error" role="alert">
                {ordersError}
              </p>
            )}
            {!ordersLoading && !orders.length && <p>{t("noOrders")}</p>}
            <div className="order-grid">
              {orders.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>
          </section>
        </section>
      </main>
      <CartDrawer
        open={cartOpen}
        items={lines}
        onClose={() => !busy && setCartOpen(false)}
        onChangeQty={changeQty}
        total={total}
        form={form}
        onFormChange={editForm}
        onSubmit={submit}
        busy={busy}
        error={error}
        locked={Boolean(recovery)}
        disabled={
          !recovery &&
          (isDemo ||
            loading ||
            Boolean(menuError) ||
            onlineOpen !== true ||
            unavailable)
        }
        isDemo={isDemo}
      />
      {count > 0 && (
        <button className="mobile-cart" onClick={() => setCartOpen(true)}>
          <span>{count}</span>
          <strong>
            {t("cart")} • {money(total)}
          </strong>
        </button>
      )}
    </>
  );
}
