/** Split a rupee amount in paise, distributing the remainder so every share sums to the goal. */
export function splitGroupGiftAmount(goal: number, people: number): number[] {
  if (!Number.isFinite(goal) || goal <= 0 || !Number.isInteger(people) || people < 1) return [];
  const paise = Math.round(goal * 100);
  const base = Math.floor(paise / people);
  const remainder = paise % people;
  return Array.from({ length: people }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}
