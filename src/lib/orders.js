import { httpsCallable } from "firebase/functions";
import { functions, restaurantId } from "../firebase/config";
export async function sendOrder(payload) {
  return (
    await httpsCallable(functions, "placeOrder")({ ...payload, restaurantId })
  ).data;
}
export async function changeOrder(orderId, changes) {
  return (
    await httpsCallable(
      functions,
      "updateOrder",
    )({ restaurantId, orderId, ...changes })
  ).data;
}
