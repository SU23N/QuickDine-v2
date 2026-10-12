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
import {TenantProvider} from "./hooks/useTenant";
import PlatformConsole from "./pages/PlatformConsole";
import RestaurantSettings from "./pages/RestaurantSettings";
import Workspace from "./pages/Workspace";
import Setup from "./pages/Setup";
import SaasHome from "./pages/SaasHome";
import DemoApp from "./demo/DemoApp";
export default function App() {
  if(import.meta.env.VITE_DEMO_WORKSPACE==='true')return <DemoWithLanguage/>;
  return <TenantProvider><LiveApp/></TenantProvider>;
}
function DemoWithLanguage(){
  const language=useLanguageState();
  return <LanguageContext.Provider value={language}><DemoApp/></LanguageContext.Provider>;
}
function LiveApp(){
  const language = useLanguageState(),
    session = useSessionState();
  return (
    <LanguageContext.Provider value={language}>
      <SessionContext.Provider value={session}>
        <Routes>
          <Route path="/" element={<SaasHome />} />
          <Route path="/console" element={<PlatformConsole/>}/>
          <Route path="/workspace" element={<Workspace/>}/>
          <Route path="/setup" element={<Setup/>}/>
          <Route path="/r/:restaurantId" element={<Home/>}/>
          <Route path="/r/:restaurantId/customer" element={<Customer/>}/>
          <Route path="/r/:restaurantId/owner" element={<StaffGate roles={['owner']}><Owner/></StaffGate>}/>
          <Route path="/r/:restaurantId/admin" element={<StaffGate roles={['owner']}><Admin/></StaffGate>}/>
          <Route path="/r/:restaurantId/kitchen" element={<StaffGate roles={['owner','kitchen','waiter']}><Kitchen/></StaffGate>}/>
          <Route path="/r/:restaurantId/waiter" element={<StaffGate roles={['owner','waiter']}><Kitchen view="waiter"/></StaffGate>}/>
          <Route path="/r/:restaurantId/settings" element={<StaffGate roles={['owner']}><RestaurantSettings/></StaffGate>}/>
          <Route path="/r/:restaurantId/billing" element={<StaffGate roles={['owner']}><RestaurantSettings billing/></StaffGate>}/>
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
