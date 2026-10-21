"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/content/schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { Pokeball } from "./Pokeball";

type MenuTexts = Dictionary["menu"] & { tagline: string; disclaimer: string; otherLanguage: string };

/** Hamburger button (fixed top left) with a slide-out navigation panel. */
export function SiteMenu({ lang, t }: { lang: Locale; t: MenuTexts }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const other: Locale = lang === "de" ? "en" : "de";
  const close = () => dialog.current?.close();

  const items = [
    { href: `/${lang}`, label: t.daily, icon: <Pokeball size={20} />, active: pathname === `/${lang}` || pathname === `/${lang}/play` },
    { href: `/${lang}/endless`, label: t.endless, icon: <span className="w-5 text-center text-2xl leading-none">∞</span>, active: pathname === `/${lang}/endless` },
  ];

  return (
    <>
      <button
        type="button"
        aria-label={t.open}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="pod fixed top-3 left-3 z-40 flex h-10 w-10 cursor-pointer items-center justify-center text-drift hover:text-moonlight"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" shapeRendering="crispEdges" aria-hidden className="h-5 w-5">
          <path d="M2 3h16v3H2zm0 6h16v3H2zm0 6h16v3H2z" />
        </svg>
      </button>

      {/* Clicks on the dialog element itself can only hit the backdrop: the panel fills it. */}
      <dialog
        ref={dialog}
        aria-labelledby="site-menu-title"
        onClick={(e) => e.target === e.currentTarget && close()}
        className="open:animate-menu-in fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,86vw)] bg-transparent p-0 text-moon backdrop:bg-[rgb(2_4_10/0.7)]"
      >
        <div className="flex h-full flex-col gap-6 bg-night-900 px-5 pt-5 pb-6 shadow-[3px_0_0_var(--color-line),0_0_40px_rgb(0_0_0/0.6)]">
          <header className="flex items-start justify-between">
            <div>
              <p className="glow text-sm tracking-[0.3em] text-moonlight">POKRILLION</p>
              <h2 id="site-menu-title" className="text-3xl leading-tight tracking-wider uppercase">
                {t.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t.close}
              className="cursor-pointer px-2 text-3xl leading-none text-drift hover:text-ball-red"
            >
              ×
            </button>
          </header>

          <nav aria-label={t.title} className="flex flex-col gap-2">
            <p className="fathom mb-1">{t.modes}</p>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                aria-current={item.active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 text-xl tracking-widest uppercase hover:bg-night-800 hover:text-moonlight ${
                  item.active ? "bg-night-800 text-moonlight shadow-[inset_3px_0_0_var(--color-ball-red)]" : ""
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2">
            <p className="fathom mb-1">{t.language}</p>
            <Link
              href={pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${other}`)}
              onClick={close}
              hrefLang={other}
              className="flex items-center gap-3 px-3 py-2 text-xl tracking-widest uppercase hover:bg-night-800 hover:text-moonlight"
            >
              <span className="w-5 text-center text-sm text-drift">{other.toUpperCase()}</span>
              <span>{t.otherLanguage}</span>
            </Link>
          </div>

          <footer className="mt-auto flex flex-col gap-3 text-base leading-snug text-drift/70">
            <p className="text-lg tracking-[0.2em] text-moonlight uppercase">{t.tagline}.</p>
            <p>{t.disclaimer}</p>
          </footer>
        </div>
      </dialog>
    </>
  );
}
