import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, localeFromAcceptLanguage } from "@/i18n/config";

/** Sends locale-less paths to /de/… or /en/… based on Accept-Language. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) return;

  const locale = localeFromAcceptLanguage(request.headers.get("accept-language"));
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (icon.svg, robots.txt, …).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
