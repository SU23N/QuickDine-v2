import {useTenant} from "../hooks/useTenant";
import {callSaas} from "../lib/saas";
import {useSubscription} from "../hooks/useSaas";
import { useEffect, useState } from "react";
import { collection, doc, setDoc, writeBatch } from "firebase/firestore";
import QRCode from "qrcode";
import RestaurantFrame from "../components/RestaurantFrame";
import MenuEditorList from "../components/MenuEditorList";
import { db } from "../firebase/config";
import { useRestaurant } from "../hooks/useRestaurant";
import { useLanguage, label, money } from "../lib/i18n";
import { menuItems } from "../data/menu";
const blank = {
  name: "",
  nameHi: "",
  description: "",
  descriptionHi: "",
  category: "Main Course",
  categoryHi: "",
  price: "",
  veg: true,
  available: true,
  emoji: "🍽️",
};
const hindiCategories = {
  "Main Course": "मुख्य भोजन",
  Breads: "रोटी",
  Rice: "चावल",
  Starters: "स्टार्टर",
  Chinese: "चाइनीज़",
  Drinks: "पेय",
  Desserts: "मिठाई",
};
const hindiDescriptions = [
  "मलाईदार टमाटर की ग्रेवी में मुलायम पनीर।",
  "मक्खन के साथ नरम तंदूरी नान।",
  "सब्जियों और मसालों के साथ खुशबूदार बासमती चावल।",
  "तंदूर में बना रसदार चिकन टिक्का।",
  "सब्जियों के साथ नूडल्स।",
  "आइसक्रीम के साथ ठंडी कॉफी।",
  "चाशनी में गर्म गुलाब जामुन।",
  "लहसुन और मसालों के तड़के वाली पीली दाल।",
];
const hindiNames = [
  "पनीर बटर मसाला",
  "बटर नान",
  "वेज बिरयानी",
  "चिकन टिक्का",
  "हक्का नूडल्स",
  "कोल्ड कॉफी",
  "गुलाब जामुन",
  "दाल तड़का",
];
export default function Admin() {
  const {restaurantId,path}=useTenant();
  const {record:subscription}=useSubscription();
  const { menu, restaurant, loading, error: loadError } = useRestaurant(),
    { lang, t } = useLanguage();
  const [editing, setEditing] = useState(null),
    [form, setForm] = useState(blank),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [qrCount, setQrCount] = useState(20),
    [codes, setCodes] = useState([]),
    [message, setMessage] = useState(""),
    [hours, setHours] = useState({
      openingTime: "10:00",
      closingTime: "22:00",
    });
  useEffect(() => {
    if (restaurant)
      setHours({
        openingTime: restaurant.openingTime || "10:00",
        closingTime: restaurant.closingTime || "22:00",
      });
  }, [restaurant]);
  const root = doc(db, "restaurants", restaurantId);
  async function run(fn) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(t("save"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function start(dish) {
    setEditing(dish?.id || "new");
    setForm(
      dish
        ? { ...blank, ...dish, price: String(dish.pricePaise / 100) }
        : blank,
    );
    setError("");
  }
  async function save(e) {
    e.preventDefault();
    await run(async () => {
      const price = Number(form.price);
      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 10000 ||
        Math.abs(price * 100 - Math.round(price * 100)) > 0.00001
      )
        throw Error("Enter a price with up to two decimal places.");
      const ref =
        editing === "new"
          ? doc(collection(root, "menu"))
          : doc(root, "menu", editing);
      await setDoc(ref, {
        name: form.name.trim(),
        nameHi: form.nameHi.trim(),
        description: form.description.trim(),
        descriptionHi: form.descriptionHi.trim(),
        category: form.category.trim(),
        categoryHi: form.categoryHi.trim(),
        pricePaise: Math.round(price * 100),
        veg: form.veg,
        available: form.available,
        emoji: form.emoji || "🍽️",
      });
      setEditing(null);
    });
  }
  async function initialize() {
    await run(async () => {
      const batch = writeBatch(db);
      if (!menu.length)
        menuItems.forEach((i, index) =>
          batch.set(doc(root, "menu", String(i.id)), {
            name: i.name,
            nameHi: hindiNames[index],
            description: i.description,
            descriptionHi: hindiDescriptions[index],
            category: i.category,
            categoryHi: hindiCategories[i.category] || "",
            pricePaise: i.price * 100,
            veg: i.veg,
            available: true,
            emoji: i.emoji,
          }),
        );
      await batch.commit();
    });
  }
  async function generate() {
    await run(async () => {
      const count = Number(qrCount);
      if (!Number.isInteger(count) || count < 1 || count > 100)
        throw Error("Choose 1–100 tables.");
      await callSaas('manageRestaurantTables',{restaurantId,count});
      const rows = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const table = String(i + 1),
            url = `${window.location.origin}${path("customer")}?table=${table}`;
          return {
            table,
            url,
            image: await QRCode.toDataURL(url, {
              width: 240,
              margin: 2,
              errorCorrectionLevel: "M",
            }),
          };
        }),
      );
      setCodes(rows);
    });
  }
  return (
    <>
      <div className="screen-content">
        <RestaurantFrame title={t('admin')} section="Menu & QR" subtitle="Keep dishes, availability and table QR codes ready for service.">
          <div className="dashboard-head">
            <h2>{lang==='hi'?'मेन्यू और उपलब्धता':'Menu & availability'}</h2>
            <button
              className="primary"
              disabled={busy || !restaurant}
              onClick={() => start(null)}
            >
              {t("addDish")}
            </button>
          </div>
          {loading && <p>{t("loading")}</p>}
          {(error || loadError) && (
            <p role="alert" className="error">
              {error || loadError}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          {restaurant && !menu.length && <section className="form-panel"><p>Start with sample dishes, then set your actual prices and availability.</p><button className="secondary" disabled={busy} onClick={initialize}>Add sample menu</button></section>}
          {!restaurant ? (
            <section className="form-panel">
              <p>{t("seedNote")}</p>
              <button
                disabled={true}
                className="primary"
                onClick={initialize}
              >
                Restaurant onboarding is managed from the QuickDine platform console.
              </button>
            </section>
          ) : (
            <section className="settings-bar">
              <strong>{restaurant.name}</strong>
              <span>
                {restaurant.acceptingOrders ? t("open") : t("closed")}
              </span>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    setDoc(
                      root,
                      { acceptingOrders: !restaurant.acceptingOrders },
                      { merge: true },
                    ),
                  )
                }
              >
                {restaurant.acceptingOrders ? t("pause") : t("resume")}
              </button>
            </section>
          )}
          {editing && (
            <form className="form-panel" onSubmit={save}>
              {[
                "name",
                "nameHi",
                "description",
                "descriptionHi",
                "category",
                "categoryHi",
              ].map((field) => (
                <label key={field}>
                  {
                    {
                      name: "Name (English)",
                      nameHi: "नाम (हिन्दी)",
                      description: "Description (English)",
                      descriptionHi: "विवरण (हिन्दी)",
                      category: "Category (English)",
                      categoryHi: "श्रेणी (हिन्दी)",
                      emoji: "Emoji",
                    }[field]
                  }
                  <input
                    required={["name", "category"].includes(field)}
                    maxLength={
                      field.startsWith("description")
                        ? 500
                        : field === "emoji"
                          ? 16
                          : field.startsWith("category")
                            ? 80
                            : 120
                    }
                    value={form[field]}
                    disabled={busy}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field]: e.target.value }))
                    }
                  />
                </label>
              ))}
              <label>
                Price (₹)
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  max="10000"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.veg}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, veg: e.target.checked }))
                  }
                />
                {t("vegOnly")}
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, available: e.target.checked }))
                  }
                />
                {t("available")}
              </label>
              <div className="order-actions">
                <button className="primary" disabled={busy}>
                  {t("save")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          )}
          {restaurant && (
            <form
              className="form-panel"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  if (hours.openingTime === hours.closingTime)
                    throw Error("Opening and closing times must differ.");
                  await setDoc(root, hours, { merge: true });
                });
              }}
            >
              <h2>
                {lang === "hi"
                  ? "रोज़ का समय (IST)"
                  : "Daily service hours (IST)"}
              </h2>
              <label>
                {lang === "hi" ? "खुलने का समय" : "Opening time"}
                <input
                  type="time"
                  required
                  value={hours.openingTime}
                  onChange={(e) =>
                    setHours((h) => ({ ...h, openingTime: e.target.value }))
                  }
                />
              </label>
              <label>
                {lang === "hi" ? "बंद होने का समय" : "Closing time"}
                <input
                  type="time"
                  required
                  value={hours.closingTime}
                  onChange={(e) =>
                    setHours((h) => ({ ...h, closingTime: e.target.value }))
                  }
                />
              </label>
              <button className="primary" disabled={busy}>
                {t("save")}
              </button>
            </form>
          )}
          <MenuEditorList menu={menu} onEdit={start} disabled={busy} onToggle={i=>run(()=>setDoc(doc(db,'restaurants',restaurantId,'menu',i.id),{available:!i.available},{merge:true}))}/>
          {restaurant && (
            <section className="qr-controls">
              <h2>{t("tables")}</h2>
              <label>
                Number of tables
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={qrCount}
                  onChange={(e) => setQrCount(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy} onClick={generate}>
                {t("tables")}
              </button>
              <p>
                {lang === "hi"
                  ? "QR में इस वेबसाइट का पता होगा। प्रकाशित वेबसाइट से कोड बनाएँ।"
                  : "QR codes use this website’s address. Generate them from the published site."}
              </p>
            </section>
          )}
        </RestaurantFrame>
      </div>
      {codes.length > 0 && (
        <section className="qr-sheet">
          <div className="screen-content">
            <button className="primary" onClick={() => window.print()}>
              Print QR codes
            </button>
          </div>
          <div className="qr-grid">
            {codes.map((c) => (
              <article key={c.table}>
                <h3>
                  QuickDine • {t("table")} {c.table}
                </h3>
                <img
                  src={c.image}
                  alt={`QR for table ${c.table}`}
                  width="240"
                  height="240"
                />
                <p>{c.url}</p>
                <a
                  className="secondary screen-content"
                  download={`quickdine-table-${c.table}.png`}
                  href={c.image}
                >
                  Download PNG
                </a>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
