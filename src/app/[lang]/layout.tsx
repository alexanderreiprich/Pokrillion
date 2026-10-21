import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pixelify_Sans, VT323 } from "next/font/google";
import Link from "next/link";
import { LOCALES, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import "../globals.css";

const vt323 = VT323({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-vt323" });
const pixelify = Pixelify_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-pixelify" });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: { languages: { de: "/de", en: "/en" } },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const other = lang === "de" ? "en" : "de";

  return (
    <html lang={lang} className={`${vt323.variable} ${pixelify.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <main className="flex w-full flex-1 flex-col px-4 py-8">{children}</main>
        <footer className="mx-auto w-full max-w-md px-4 pb-6 text-center text-base leading-snug text-drift/70">
          <p>{dict.footer.disclaimer}</p>
          <Link href={`/${other}`} className="mt-2 inline-block text-moonlight hover:underline">
            {dict.footer.language}
          </Link>
        </footer>
      </body>
    </html>
  );
}
