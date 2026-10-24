import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Curation view. Access is guarded by Basic auth in proxy.ts and again in lib/server/admin.ts. */
export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { admin } = await getDictionary(lang);
  const base = `/${lang}/admin`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pt-16 pb-8">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl text-electric">Pokrillion · {admin.title}</h1>
        <Link href={`/${lang}`} className="text-moonlight hover:underline">
          pokrillion.io
        </Link>
      </header>
      <Suspense fallback={<div className="h-12 border-b-2 border-line" />}>
        <AdminNav
          items={[
            { href: base, label: admin.nav.overview },
            { href: `${base}/unknown`, label: admin.nav.unknown },
            { href: `${base}/disputed`, label: admin.nav.disputed },
            { href: `${base}/questions`, label: admin.nav.questions },
          ]}
          ranges={[
            { value: "7", label: admin.range.d7 },
            { value: "30", label: admin.range.d30 },
            { value: "all", label: admin.range.all },
          ]}
        />
      </Suspense>
      {children}
    </main>
  );
}
