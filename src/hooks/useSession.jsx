import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, configured, restaurantId } from "../firebase/config";
export const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);
export function useSessionState() {
  const [user, setUser] = useState(null),
    [staff, setStaff] = useState(null),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState("");
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setStaff(null);
      setLoading(Boolean(u));
      setError("");
    });
  }, []);
  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(
      doc(db, "staff", user.uid),
      (snap) => {
        const s = snap.data();
        setLoading(false);
        setStaff(
          s?.active === true &&
            s.restaurantId === restaurantId &&
            ["owner", "kitchen", "waiter"].includes(s.role)
            ? s
            : null,
        );
      },
      (e) => {
        setLoading(false);
        setError(e.message);
        setStaff(null);
      },
    );
  }, [user]);
  async function ensureCustomer() {
    if (!auth) throw new Error("Ordering is unavailable.");
    if (auth.currentUser) return auth.currentUser;
    return (await signInAnonymously(auth)).user;
  }
  return { user, staff, loading, error, ensureCustomer };
}
