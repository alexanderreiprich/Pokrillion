"use client";

import { useSyncExternalStore } from "react";

const subscribers = new Map<number, (callback: () => void) => () => void>();

function subscribeEvery(intervalMs: number) {
  let subscribe = subscribers.get(intervalMs);
  if (!subscribe) {
    subscribe = (callback) => {
      const id = setInterval(callback, intervalMs);
      return () => clearInterval(id);
    };
    subscribers.set(intervalMs, subscribe);
  }
  return subscribe;
}

/** Current time, re-rendering every `intervalMs`. Returns 0 during SSR. */
export function useNow(intervalMs: number): number {
  return useSyncExternalStore(
    subscribeEvery(intervalMs),
    // Rounded so consecutive snapshots within one tick are identical.
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}
