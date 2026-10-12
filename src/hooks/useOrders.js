import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {useTenant} from "./useTenant";
export function useOrders(uid, staff = false) {
  const {restaurantId}=useTenant();
  const [orders, setOrders] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setOrders([]);
    setError("");
    if (!db || !uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const base = collection(db, "restaurants", restaurantId, "orders");
    const q = staff
      ? query(base, orderBy("createdAt", "desc"), limit(200))
      : query(
          base,
          where("customerUid", "==", uid),
          orderBy("createdAt", "desc"),
          limit(20),
        );
    return onSnapshot(
      q,
      (s) => {
        setOrders(s.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
        setError("");
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [uid, staff, restaurantId]);
  return { orders, loading, error };
}
