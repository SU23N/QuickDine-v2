import { useEffect, useRef } from "react";
import { useLanguage, label, money } from "../lib/i18n";
export default function CartDrawer({
  open,
  items,
  onClose,
  onChangeQty,
  total,
  form,
  onFormChange,
  onSubmit,
  busy,
  error,
  disabled,
  isDemo,
  locked,
}) {
  const { lang, t } = useLanguage(),
    drawer = useRef(null),
    closeButton = useRef(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    closeButton.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const nodes = [
          ...drawer.current.querySelectorAll(
            "button:not(:disabled),input,select,textarea,a[href]",
          ),
        ].filter((n) => n.offsetParent !== null);
        if (!nodes.length) return;
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [open]);
  const scheduled = form.mode !== "table";
  return (
    <>
      <div
        className={open ? "drawer-backdrop show" : "drawer-backdrop"}
        onClick={onClose}
      />
      <aside
        ref={drawer}
        inert={!open}
        role="dialog"
        aria-hidden={!open}
        aria-modal={open ? "true" : undefined}
        aria-labelledby="cart-title"
        className={open ? "cart-drawer open" : "cart-drawer"}
      >
        <div className="drawer-head">
          <h2 id="cart-title">{t("cart")}</h2>
          <button
            ref={closeButton}
            aria-label={t("close")}
            className="icon-button"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <form className="cart-form" onSubmit={onSubmit}>
          <div className="drawer-items">
            <label>
              {t("mode")}
              <select
                disabled={busy || locked}
                value={form.mode}
                onChange={(e) => onFormChange("mode", e.target.value)}
              >
                <option value="table">{t("tableMode")}</option>
                <option value="advance-dine-in">{t("advanceMode")}</option>
                <option value="takeaway">{t("takeawayMode")}</option>
              </select>
            </label>
            {form.mode === "table" ? (
              <p>
                {form.tableId
                  ? `${t("table")} ${form.tableId}`
                  : t("tableMissing")}
              </p>
            ) : (
              <div className="checkout-fields">
                <label>
                  {t("name")}
                  <input
                    required
                    maxLength="80"
                    minLength="2"
                    autoComplete="name"
                    value={form.name}
                    disabled={busy || locked}
                    onChange={(e) => onFormChange("name", e.target.value)}
                  />
                </label>
                <label>
                  {t("phone")}
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    maxLength="15"
                    value={form.phone}
                    disabled={busy || locked}
                    onChange={(e) => onFormChange("phone", e.target.value)}
                  />
                </label>
                <label>
                  {t("time")} (IST)
                  <input
                    required
                    type="datetime-local"
                    value={form.time}
                    disabled={busy || locked}
                    onChange={(e) => onFormChange("time", e.target.value)}
                  />
                </label>
                <small>
                  {lang === "hi"
                    ? "15 मिनट से 7 दिन आगे का समय चुनें।"
                    : "Choose a time 15 minutes to 7 days ahead."}
                </small>
              </div>
            )}
            {!items.length ? (
              <p className="empty-cart">{t("empty")}</p>
            ) : (
              items.map((item) => (
                <div className="cart-line" key={item.id}>
                  <div>
                    <strong>{label(item, "name", lang)}</strong>
                    <small>
                      {item.available
                        ? money(item.pricePaise)
                        : t("unavailable")}
                    </small>
                  </div>
                  <div className="qty">
                    <button
                      type="button"
                      disabled={busy || locked}
                      aria-label={`Decrease ${item.name}`}
                      onClick={() => onChangeQty(item.id, -1)}
                    >
                      −
                    </button>
                    <span>{item.qty}</span>
                    <button
                      type="button"
                      disabled={busy || locked || item.qty >= 20}
                      aria-label={`Increase ${item.name}`}
                      onClick={() => onChangeQty(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
            <label>
              {t("instructions")}
              <textarea
                maxLength="500"
                placeholder={t("specialHint")}
                value={form.instructions}
                disabled={busy || locked}
                onChange={(e) => onFormChange("instructions", e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {isDemo && <p className="notice">{t("demo")}</p>}
          </div>
          <div className="drawer-footer">
            <small>{t("note")}</small>
            <div className="total-row">
              <span>{t("total")}</span>
              <strong>{money(total)}</strong>
            </div>
            <button
              className="primary wide"
              disabled={
                busy ||
                disabled ||
                !items.length ||
                (!scheduled && !form.tableId)
              }
            >
              {busy ? t("sending") : locked ? t("retry") : t("place")}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
