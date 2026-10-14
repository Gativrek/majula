/**
 * "Streak 1 day", never "1 days": the kind of thing that survives review and then annoys
 * forever (`docs/modules/habits.md`).
 */
export function streakText(streak: number): string {
  return streak === 1 ? 'Streak 1 day' : `Streak ${streak} days`;
}

/** The unit beside a streak card's number. */
export function dayUnit(streak: number): string {
  return streak === 1 ? 'day' : 'days';
}
