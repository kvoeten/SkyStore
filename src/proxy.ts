import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  const path = request.nextUrl.pathname;
  if (path === "/") return NextResponse.next();
  if (!request.auth) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  if (request.auth.user.quarantined) return NextResponse.redirect(new URL("/login?error=quarantined", request.nextUrl.origin));
  const user = request.auth.user;
  const isAdmin = user.globalRole === "platform_admin";
  if ((path.startsWith("/platform") || path.startsWith("/catalog")) && !isAdmin) {
    return NextResponse.redirect(new URL("/guide?error=platform_forbidden", request.nextUrl.origin));
  }
  const managerOnly = path.startsWith("/store-admin");
  if (managerOnly && !isAdmin && !user.storeAccess.some((access) => access.role === "manager" || access.role === "owner")) {
    return NextResponse.redirect(new URL("/guide?error=manager_forbidden", request.nextUrl.origin));
  }
  const verifiedOnly = path.startsWith("/approvals");
  if (verifiedOnly && !isAdmin && !user.storeAccess.some((access) => access.trust === "verified")) {
    return NextResponse.redirect(new URL("/guide?error=verified_forbidden", request.nextUrl.origin));
  }
  const staffPaths = ["/dashboard", "/inventory", "/items", "/receipts", "/street-report", "/reports", "/store-admin", "/approvals"];
  if (staffPaths.some((prefix) => path.startsWith(prefix)) && !isAdmin && user.storeAccess.length === 0) {
    return NextResponse.redirect(new URL("/guide?error=store_forbidden", request.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  // Public route handlers enforce their own command authorization. Keeping
  // them outside the redirecting page proxy lets catalog search return JSON
  // and lets an unsigned report POST return a machine-readable 401.
  matcher: ["/((?!api/auth|api/health|api/v1/market/public|api/v1/market/reports|api/v1/catalog/public-items|_next/static|_next/image|brand/|catalog-icons/|item-renders/|favicon.ico|login|logout|guide|professions).*)"]
};
