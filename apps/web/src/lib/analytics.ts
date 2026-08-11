import posthog from "posthog-js";

/**
 * Fire-and-forget custom event.
 *
 * PostHog is only initialised after the user accepts the cookie banner
 * (see components/analytics-consent.tsx), so `__loaded` is false for a large
 * share of visits and this is a no-op for them. That is deliberate: anything
 * that must be counted exactly is counted from the database on /admin instead,
 * and these events exist only to attribute the pre-login half of the funnel,
 * where there is no database row to count.
 */
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}
