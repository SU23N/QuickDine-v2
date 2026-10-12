import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";
export async function sendOrder(payload, restaurantId) {
  return (
    await httpsCallable(functions, "placeOrder")({ ...payload, restaurantId })
  ).data;
}
export async function changeOrder(orderId, changes, restaurantId) {
  return (
    await httpsCallable(
      functions,
      "updateOrder",
    )({ restaurantId, orderId, ...changes })
  ).data;
}
