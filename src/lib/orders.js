import { httpsCallable } from "firebase/functions";
import { functions, restaurantId } from "../firebase/config";
export async function sendOr…3491 tokens truncated…panel"
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
          <div className="menu-management">
            {menu.map((i) => (
              <article className="admin-card" key={i.id}>
                <h3>{label(i, "name", lang)}</h3>
                <p>
                  {money(i.pricePaise)} •{" "}
                  {i.available ? t("available") : t("unavailable")}
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => start(i)}
                >
                  {t("edit")}
                </button>
              </article>
            ))}
          </div>
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
        </main>
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
