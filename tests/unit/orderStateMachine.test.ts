import { describe, it, expect } from "vitest";
import {
  isValidStoreTransition,
  isValidAdminOverride,
  buildTimeline,
  getValidStoreTransitions,
} from "@/lib/services/orderStateMachine";

describe("store transitions", () => {
  it("allows ORDER_PLACED -> STORE_ACCEPTED", () => {
    expect(isValidStoreTransition("ORDER_PLACED", "STORE_ACCEPTED")).toBe(true);
  });
  it("allows ORDER_PLACED -> REJECTED", () => {
    expect(isValidStoreTransition("ORDER_PLACED", "REJECTED")).toBe(true);
  });
  it("forbids skipping PREPARING_GIFT -> OUT_FOR_DELIVERY", () => {
    expect(isValidStoreTransition("PREPARING_GIFT", "OUT_FOR_DELIVERY")).toBe(false);
  });
  it("forbids reversing OUT_FOR_DELIVERY -> PREPARING_GIFT", () => {
    expect(isValidStoreTransition("OUT_FOR_DELIVERY", "PREPARING_GIFT")).toBe(false);
  });
  it("forbids transitions out of terminal states", () => {
    expect(getValidStoreTransitions("DELIVERED")).toEqual([]);
    expect(getValidStoreTransitions("REJECTED")).toEqual([]);
  });
  it("forbids accepting an already-rejected order", () => {
    expect(isValidStoreTransition("REJECTED", "STORE_ACCEPTED")).toBe(false);
  });
});

describe("admin override", () => {
  it("allows overriding to any different status, including correcting a terminal one", () => {
    expect(isValidAdminOverride("DELIVERED", "PREPARING_GIFT")).toBe(true);
    expect(isValidAdminOverride("REJECTED", "STORE_ACCEPTED")).toBe(true);
  });
  it("forbids overriding to the same status", () => {
    expect(isValidAdminOverride("PREPARING_GIFT", "PREPARING_GIFT")).toBe(false);
  });
});

describe("timeline building", () => {
  const baseHistory = [
    { status: "ORDER_PLACED" as const, changedAt: new Date("2026-01-01T00:00:00Z"), isAdminOverride: false },
    { status: "STORE_ACCEPTED" as const, changedAt: new Date("2026-01-01T01:00:00Z"), isAdminOverride: false },
    { status: "PREPARING_GIFT" as const, changedAt: new Date("2026-01-01T02:00:00Z"), isAdminOverride: false },
  ];

  it("marks steps up to current as completed with real timestamps", () => {
    const steps = buildTimeline("PREPARING_GIFT", baseHistory);
    expect(steps[0].state).toBe("completed");
    expect(steps[1].state).toBe("completed");
    expect(steps[2].state).toBe("current");
    expect(steps[3].state).toBe("upcoming");
    expect(steps[0].timestamp).not.toBeNull();
  });

  it("renders history received through JSON on customer and admin pages", () => {
    const jsonHistory = baseHistory.map((entry) => ({ ...entry, changedAt: entry.changedAt.toISOString() }));
    expect(buildTimeline("PREPARING_GIFT", jsonHistory)).toEqual(buildTimeline("PREPARING_GIFT", baseHistory));
  });

  it("marks an admin-skipped intermediate step without fabricating a timestamp", () => {
    // Admin jumped straight from STORE_ACCEPTED to OUT_FOR_DELIVERY: no natural
    // history for PREPARING_GIFT or READY_FOR_PICKUP.
    const history = [
      { status: "ORDER_PLACED" as const, changedAt: new Date("2026-01-01T00:00:00Z"), isAdminOverride: false },
      { status: "STORE_ACCEPTED" as const, changedAt: new Date("2026-01-01T01:00:00Z"), isAdminOverride: false },
      { status: "OUT_FOR_DELIVERY" as const, changedAt: new Date("2026-01-01T02:00:00Z"), isAdminOverride: true },
    ];
    const steps = buildTimeline("OUT_FOR_DELIVERY", history);
    const preparing = steps.find((s) => s.status === "PREPARING_GIFT")!;
    const readyForPickup = steps.find((s) => s.status === "READY_FOR_PICKUP")!;
    expect(preparing.state).toBe("admin-skipped");
    expect(preparing.timestamp).toBeNull();
    expect(readyForPickup.state).toBe("admin-skipped");
  });

  it("renders progress from the current status after a backward correction, not the highest ever reached", () => {
    // Order reached DELIVERED naturally, then admin corrected it back to PREPARING_GIFT.
    const history = [
      { status: "ORDER_PLACED" as const, changedAt: new Date("2026-01-01T00:00:00Z"), isAdminOverride: false },
      { status: "STORE_ACCEPTED" as const, changedAt: new Date("2026-01-01T01:00:00Z"), isAdminOverride: false },
      { status: "PREPARING_GIFT" as const, changedAt: new Date("2026-01-01T02:00:00Z"), isAdminOverride: false },
      { status: "READY_FOR_PICKUP" as const, changedAt: new Date("2026-01-01T03:00:00Z"), isAdminOverride: false },
      { status: "OUT_FOR_DELIVERY" as const, changedAt: new Date("2026-01-01T04:00:00Z"), isAdminOverride: false },
      { status: "DELIVERED" as const, changedAt: new Date("2026-01-01T05:00:00Z"), isAdminOverride: false },
      { status: "PREPARING_GIFT" as const, changedAt: new Date("2026-01-01T06:00:00Z"), isAdminOverride: true },
    ];
    const steps = buildTimeline("PREPARING_GIFT", history);
    const delivered = steps.find((s) => s.status === "DELIVERED")!;
    const readyForPickup = steps.find((s) => s.status === "READY_FOR_PICKUP")!;
    // These happened in the past (real timestamps exist) but are AFTER the
    // current (corrected) status, so progress must show them as upcoming.
    expect(delivered.state).toBe("upcoming");
    expect(readyForPickup.state).toBe("upcoming");
    expect(steps.find((s) => s.status === "PREPARING_GIFT")!.state).toBe("current");
  });

  it("returns no timeline steps for a rejected order", () => {
    expect(buildTimeline("REJECTED", [])).toEqual([]);
  });
});
