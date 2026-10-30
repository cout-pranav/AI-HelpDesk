// "Good morning/afternoon/evening" for an hour of the day (0–23) in the viewer's time zone.
export function greeting(hour: number) {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
