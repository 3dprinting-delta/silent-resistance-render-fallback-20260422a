import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/deadzone")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const temporaryTokenExpired =
    token?.accessMode === "temporary" &&
    typeof token.temporaryAccessExpiresAt === "number" &&
    token.temporaryAccessExpiresAt <= Date.now();

  if (token && !temporaryTokenExpired) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const nextValue = `${pathname}${search}`;

  if (nextValue && nextValue !== "/login") {
    loginUrl.searchParams.set("next", nextValue);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
