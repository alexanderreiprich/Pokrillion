import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PATH, ADMIN_REALM, isAdminAuthorized } from "@/lib/admin-auth";
import { hasLocale, localeFromAcceptLanguage } from "@/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Curation view: HTTP Basic auth; without ADMIN_PASSWORD it doesn't exist at all.
  if (ADMIN_PATH.test(pathname)) {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) return new NextResponse(null, { status: 404 });
    if (!isAdminAuthorized(request.headers.get("authorization"), password)) {
      return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": ADMIN_REALM } });
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // Locale-less paths go to /de/… or /en/… based on Accept-Language.
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
