import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db, restaurantId } from "../firebase/config";
export function useOrders(uid, staff = false) {
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
      ? query(base, orderBy("createdAt", "desc"))
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
  }, [uid, staff]);
  return { orders, loading, error };
}
