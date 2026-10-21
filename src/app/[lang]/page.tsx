import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { DialogBox } from "@/components/DialogBox";
import { Logo } from "@/components/Logo";
import { TierList } from "@/components/TierList";
import { TodayBadge } from "@/components/TodayBadge";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col gap-8">
      <Logo tagline={dict.brand.tagline} />

      <section className="flex flex-col items-center gap-3">
        <p className="text-2xl text-electric">
          <TodayBadge today={dict.home.today} comingSoon={dict.home.comingSoon} locale={lang} />
        </p>
        <Link
          href={`/${lang}/play`}
          className="pixel-button bg-ball-red px-10 py-2 font-display text-3xl text-moon hover:brightness-110"
        >
          {dict.home.play}
        </Link>
        <Link href={`/${lang}/endless`} className="text-xl text-moonlight hover:underline">
          {dict.home.endless} →
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-drift">{dict.home.howTo}</h2>
        <DialogBox>
          <ul className="flex flex-col gap-2 text-xl">
            {dict.home.rules.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden>▸</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </DialogBox>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-drift">{dict.home.tiers}</h2>
        <div className="rounded-md border-2 border-line bg-night-900/80 p-4">
          <TierList labels={dict.tiers} />
        </div>
      </section>
    </div>
  );
}
