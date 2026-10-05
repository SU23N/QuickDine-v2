import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Customer from "./pages/Customer";
import Kitchen from "./pages/Kitchen";
import Owner from "./pages/Owner";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import { LanguageContext, useLanguageState } from "./lib/i18n";
import { SessionContext, useSessionState } from "./hooks/useSession";
import StaffGate from "./components/StaffGate";
export default function App() {
  const language = useLanguageState(),
    session = useSessionState();
  return (
    <LanguageContext.Provider value={language}>
      <SessionContext.Provider value={session}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/customer" element={<Customer />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/kitchen"
            element={
              <StaffGate roles={["owner", "kitchen", "waiter"]}>
                <Kitchen />
              </StaffGate>
            }
          />
          <Route
            path="/owner"
            element={
              <StaffGate roles={["owner"]}>
                <Owner />
              </StaffGate>
            }
          />
          <Route
            path="/admin"
            element={
              <StaffGate roles={["owner"]}>
                <Admin />
              </StaffGate>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </SessionContext.Provider>
    </LanguageContext.Provider>
  );
}
