import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Game } from "@/components/game/Game";

export default async function PlayPage({ params }: PageProps<"/[lang]/play">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { play, summary, tiers, categories, errors } = await getDictionary(lang);

  return <Game lang={lang} t={{ play, summary, tiers, categories, errors }} />;
}
