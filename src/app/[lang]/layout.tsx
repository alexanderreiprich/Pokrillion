import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { VT323 } from "next/font/google";
import { LOCALES, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Backdrop } from "@/components/Backdrop";
import { SiteMenu } from "@/components/SiteMenu";
import "../globals.css";

const vt323 = VT323({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-vt323" });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: "#050a14",
};

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

  return (
    <html lang={lang} className={`${vt323.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Backdrop />
        {/* usePathname() is runtime data on dynamic routes like /admin/questions/[id]. */}
        <Suspense fallback={null}>
          <SiteMenu
            lang={lang}
            t={{
              ...dict.menu,
              tagline: dict.brand.tagline,
              disclaimer: dict.footer.disclaimer,
              otherLanguage: dict.footer.language,
            }}
          />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
