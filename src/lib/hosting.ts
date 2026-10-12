export const GRACE_DAYS = 7;
export const DELETE_AFTER_DAYS = 30;
export const PREVIEW_MS = 5 * 60_000;

export type HostingStatus =
  | { state: "active" }
  | { state: "grace"; daysLeft: number }
  | { state: "offline"; daysToDelete: number }
  | { state: "deleted" };

/** When the owner's paid package ended (null = still active). */
export function planEndedAt(opts: { planExpiresAt: string | null; planEndedAt: string | null }) {
  let ended: number | null = opts.planEndedAt ? new Date(opts.planEndedAt).getTime() : null;
  if (!ended && opts.planExpiresAt && new Date(opts.planExpiresAt).getTime() < Date.now()) ended = new Date(opts.planExpiresAt).getTime();
  return ended;
}

/**
 * Day 1..grace: notice page instead of the site. grace..deleteAfter: offline.
 * After deleteAfter: files and data are permanently deleted by the daily job.
 */
export function hostingStatus(opts: {
  planExpiresAt: string | null;
  planEndedAt: string | null;
  fallbackCanHost: boolean;
  graceDays?: number;
  deleteAfterDays?: number;
}): HostingStatus {
  const ended = planEndedAt(opts);
  if (!ended || opts.fallbackCanHost) return { state: "active" };
  const grace = opts.graceDays ?? GRACE_DAYS;
  const del = Math.max(opts.deleteAfterDays ?? DELETE_AFTER_DAYS, grace);
  const days = (Date.now() - ended) / 86400_000;
  if (days < grace) return { state: "grace", daysLeft: Math.ceil(grace - days) };
  if (days < del) return { state: "offline", daysToDelete: Math.ceil(del - days) };
  return { state: "deleted" };
}
