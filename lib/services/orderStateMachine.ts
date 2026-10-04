import { OrderStatus } from "@prisma/client";

/** Canonical customer-facing sequence (excludes the REJECTED exception state). */
export const ORDER_SEQUENCE: OrderStatus[] = [
  "ORDER_PLACED",
  "STORE_ACCEPTED",
  "PREPARING_GIFT",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  ORDER_PLACED: "Order Placed",
  STORE_ACCEPTED: "Store Accepted",
  PREPARING_GIFT: "Preparing Gift",
  READY_FOR_PICKUP: "Ready for Pickup",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  REJECTED: "Rejected",
};

export const ORDER_STATUS_EXPLANATIONS: Record<OrderStatus, string> = {
  ORDER_PLACED: "Waiting for the store to accept your order.",
  STORE_ACCEPTED: "The store has accepted your order and will begin preparing it soon.",
  PREPARING_GIFT: "Your gift is being prepared with care.",
  READY_FOR_PICKUP: "Your gift is ready and waiting for pickup by our delivery partner.",
  OUT_FOR_DELIVERY: "Your gift is on its way!",
  DELIVERED: "Delivered! We hope it brought a smile.",
  REJECTED: "This order was rejected by the store.",
};

/** Store-owner-initiated transitions. Each entry lists allowed next statuses. */
const STORE_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  ORDER_PLACED: ["STORE_ACCEPTED", "REJECTED"],
  STORE_ACCEPTED: ["PREPARING_GIFT"],
  PREPARING_GIFT: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: [], // marking Delivered is reserved for the delivery/admin level, not the store owner
  DELIVERED: [],
  REJECTED: [],
};

export function getValidStoreTransitions(current: OrderStatus): OrderStatus[] {
  return STORE_TRANSITIONS[current] ?? [];
}

export function isValidStoreTransition(current: OrderStatus, target: OrderStatus): boolean {
  return getValidStoreTransitions(current).includes(target);
}

/** Admins may override to any supported status (including correcting terminal states). */
export function isValidAdminOverride(current: OrderStatus, target: OrderStatus): boolean {
  return current !== target;
}

export type TimelineStepState = "completed" | "current" | "upcoming" | "admin-skipped";

export interface TimelineStep {
  status: OrderStatus;
  label: string;
  state: TimelineStepState;
  timestamp: string | null;
}

export interface HistoryEntryLike {
  status: OrderStatus;
  changedAt: Date | string;
  isAdminOverride: boolean;
}

/**
 * Derives the 6-step timeline from the order's CURRENT status (not the highest
 * status ever recorded), per the rule: if an admin moves a status backwards,
 * progress reflects where the order is now. Steps at/under the current index
 * that have no natural (non-override) recorded timestamp are shown as
 * admin-skipped rather than fabricated as having happened.
 */
export function buildTimeline(currentStatus: OrderStatus, history: HistoryEntryLike[]): TimelineStep[] {
  if (currentStatus === "REJECTED") return [];
  const currentIndex = ORDER_SEQUENCE.indexOf(currentStatus);

  const naturalTimestampByStatus = new Map<OrderStatus, Date | string>();
  for (const h of history) {
    if (!h.isAdminOverride && !naturalTimestampByStatus.has(h.status)) {
      naturalTimestampByStatus.set(h.status, h.changedAt);
    }
  }

  return ORDER_SEQUENCE.map((status, index) => {
    const naturalTs = naturalTimestampByStatus.get(status) ?? null;
    let state: TimelineStepState;
    if (index === currentIndex) {
      state = "current";
    } else if (index < currentIndex) {
      state = naturalTs ? "completed" : "admin-skipped";
    } else {
      state = "upcoming";
    }
    return {
      status,
      label: ORDER_STATUS_LABELS[status],
      state,
      timestamp: naturalTs ? new Date(naturalTs).toISOString() : null,
    };
  });
}
