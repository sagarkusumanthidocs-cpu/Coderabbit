import { describe, expect, it } from "vitest";
import { splitGroupGiftAmount } from "@/lib/groupGiftSplit";

describe("group gift equal contributions", () => {
  it("fully funds a goal that cannot be split into whole rupees", () => {
    const shares = splitGroupGiftAmount(100, 3);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(shares.reduce((sum, share) => sum + Math.round(share * 100), 0)).toBe(10000);
  });
  it("preserves paise for decimal goals", () => {
    expect(splitGroupGiftAmount(10.01, 2)).toEqual([5.01, 5]);
  });
});
