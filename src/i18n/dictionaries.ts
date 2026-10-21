import "server-only";
import type { Locale } from "./config";
import type de from "./dictionaries/de.json";

export type Dictionary = typeof de;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  de: () => import("./dictionaries/de.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export const getDictionary = (locale: Locale) => dictionaries[locale]();
export { fill } from "./fill";
