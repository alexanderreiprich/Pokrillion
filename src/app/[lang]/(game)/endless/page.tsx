import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Endless } from "@/components/game/Endless";

export default async function EndlessPage({ params }: PageProps<"/[lang]/endless">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { play, summary, tiers, categories, errors, endless } = await getDictionary(lang);

  return <Endless lang={lang} t={{ play, summary, tiers, categories, errors, endless }} />;
}
