"use client";

import { useSyncExternalStore } from "react";
import { LAUNCH_DATE, localIsoDate, puzzleNumber } from "@/lib/game/puzzle-date";

const noopSubscribe = () => () => {};

/**
 * "Pokrillion #N" for the player's *local* date. Rendered on the client only,
 * because the server can't know the visitor's time zone.
 */
export function TodayBadge({ today, comingSoon, locale }: { today: string; comingSoon: string; locale: string }) {
  const date = useSyncExternalStore(noopSubscribe, () => localIsoDate(), () => null);
  if (!date) return <span className="invisible">…</span>;

  const number = puzzleNumber(date);
  if (number < 1) {
    const launch = new Date(`${LAUNCH_DATE}T00:00:00`).toLocaleDateString(locale, { dateStyle: "long" });
    return <span>{comingSoon.replace("{date}", launch)}</span>;
  }
  return <span>{today.replace("{number}", String(number))}</span>;
}
