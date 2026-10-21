"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Item = { href: string; label: string };

/** Section tabs + time range; the range is kept when switching sections. */
export function AdminNav({ items, ranges }: { items: Item[]; ranges: { value: string; label: string }[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const range = params.get("days") ?? "30";
  const withRange = (href: string, days = range) => `${href}?days=${days}`;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-line pb-3">
      <ul className="flex flex-wrap gap-1">
        {items.map((item) => {
          const active = item.href === pathname || (item.href !== items[0].href && pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={withRange(item.href)}
                className={`rounded-sm px-3 py-1 text-xl ${active ? "bg-night-800 text-electric" : "text-drift hover:text-moon"}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <ul className="flex gap-1">
        {ranges.map((r) => (
          <li key={r.value}>
            <Link
              href={withRange(pathname, r.value)}
              className={`rounded-sm border-2 px-2 text-lg ${r.value === range ? "border-moonlight text-moonlight" : "border-line text-drift hover:text-moon"}`}
            >
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
