import "server-only";

/**
 * Lock-screen copy for the scheduled pushes (FR-19, FR-20).
 *
 * Kept apart from the jobs that send them so the wording can be read and changed without
 * touching scheduling logic — this is the app's voice at 9pm and 5am, when nobody wants to
 * read twice.
 *
 * Both handle a null verdict, because a Break with no conditions is the *normal* state right
 * now: SwellCloud is down and mock data only fills in where the poll has run. Saying "no read
 * yet" is honest; silently sending an empty line is not.
 */

/**
 * FR-19, ~9pm.
 *
 * **Deliberately not phrased as a forecast.** FR-19 asks for a preview of *next-day*
 * conditions, and nothing in this system holds tomorrow's data — the poll caches the current
 * model run only. Promising someone what the morning looks like, on the strength of this
 * evening's numbers, is the kind of confident wrongness that gets somebody up at 5am for
 * nothing. It presents the latest read and lets them decide.
 */
export function nightBeforeMessage(
  verdict: string | null,
  breakLabel: string,
): string {
  if (!verdict) {
    return `${breakLabel} — no conditions read yet. Worth a look in the morning.`;
  }
  return `${breakLabel}, latest read: ${verdict}`;
}

/** FR-20, 5–5:30am. One line, current conditions, for someone who is barely awake. */
export function dawnPatrolMessage(
  verdict: string | null,
  breakLabel: string,
): string {
  if (!verdict) {
    return `${breakLabel} — no conditions read this morning.`;
  }
  return `${breakLabel}: ${verdict}`;
}
