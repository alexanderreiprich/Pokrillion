import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Logo } from "@/components/Logo";
import { TierList } from "@/components/TierList";
import { TodayBadge } from "@/components/TodayBadge";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-24 pb-28">
      <Logo tagline={dict.brand.tagline} />
      <p className="mt-3 text-center text-[clamp(14px,4vw,20px)] tracking-[0.08em] text-drift">
        {dict.home.subline} ·{" "}
        <span className="text-electric">
          <TodayBadge today={dict.home.today} comingSoon={dict.home.comingSoon} locale={lang} />
        </span>
      </p>

      <div className="mt-14 flex flex-col items-center gap-7">
        <Link
          href={`/${lang}/play`}
          className="btn-ring animate-bob px-10 pt-3.5 pb-3 text-[clamp(22px,6vw,28px)] [animation-duration:1.9s]"
        >
          {dict.home.play}
        </Link>
        <Link href={`/${lang}/endless`} className="btn-quiet px-5 pt-2.5 pb-2 text-base">
          ∞ {dict.home.endless}
        </Link>
      </div>

      <div className="mt-14 flex flex-col gap-5">
        <details className="group">
          <summary className="cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden tracking-[0.18em] text-drift uppercase hover:text-moon">
            <span className="group-open:hidden">▸ </span>
            <span className="hidden group-open:inline">▾ </span>
            {dict.home.howTo}
          </summary>
          <ul className="mt-3 flex flex-col gap-1.5 text-[15px] tracking-[0.06em] text-drift uppercase">
            {dict.home.rules.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden className="text-ball-red">▸</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </details>

        <details className="group">
          <summary className="cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden tracking-[0.18em] text-drift uppercase hover:text-moon">
            <span className="group-open:hidden">▸ </span>
            <span className="hidden group-open:inline">▾ </span>
            {dict.home.tiers}
          </summary>
          <div className="mt-4">
            <TierList labels={dict.tiers} />
          </div>
        </details>
      </div>

      <footer className="mt-auto pt-14 text-center text-sm leading-snug text-drift/60">{dict.footer.disclaimer}</footer>
    </main>
  );
}
