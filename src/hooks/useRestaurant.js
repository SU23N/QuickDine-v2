import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db, configured } from "../firebase/config";
import {useTenant} from "./useTenant";
import { menuItems } from "../data/menu";
const demoMenu = menuItems.map((i) => ({
  ...i,
  id: String(i.id),
  pricePaise: i.price * 100,
  available: true,
}));
export function useRestaurant() {
  const {restaurantId}=useTenant();
  const [menu, setMenu] = useState(configured ? [] : demoMenu),
    [restaurant, setRestaurant] = useState(null),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState("");
  useEffect(() => {
    setRestaurant(null);setMenu(configured?[]:demoMenu);setLoading(configured);setError("");
    if (!db) return;
    const fail = (e) => {
      setError(e.message);
      setLoading(false);
    };
    const stopMenu = onSnapshot(
      collection(db, "restaurants", restaurantId, "menu"),
      (snap) => {
        setMenu(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
        setError("");
      },
      fail,
    );
    const stopRestaurant = onSnapshot(
      doc(db, "restaurants", restaurantId),
      (snap) => setRestaurant(snap.exists() ? snap.data() : null),
      fail,
    );
    return () => {
      stopMenu();
      stopRestaurant();
    };
  }, [restaurantId]);
  return { menu, restaurant, loading, error, isDemo: !configured };
}
