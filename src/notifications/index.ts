/**
 * Public barrel export for the Verifii Notification Layer (NTF-000A).
 */

export * from "./types";
export * from "./events";
export * from "./registry";
export * from "./idempotency";
export { dispatchNotification, registerDeliveryAdapter } from "./dispatcher";
