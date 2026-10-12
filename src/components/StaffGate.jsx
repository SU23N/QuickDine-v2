import { Link } from "react-router-dom";
import Nav from "./Nav";
import { useSession } from "../hooks/useSession";
import { useLanguage } from "../lib/i18n";
import {useTenant} from "../hooks/useTenant";
export default function StaffGate({ roles, children }) {
  const {path}=useTenant();
  const { staff, loading, error } = useSession(),
    { t } = useLanguage();
  if (loading)
    return (
      <>
        <Nav />
        <main className="dashboard-page">{t("loading")}</main>
      </>
    );
  if (!staff || !roles.includes(staff.role))
    return (
      <>
        <Nav />
        <main className="dashboard-page">
          <h1>{t("staffOnly")}</h1>
          {error && <p role="alert">{error}</p>}
          <Link className="primary" to="/login">
            {t("login")}
          </Link>
        </main>
      </>
    );
  return children;
}
