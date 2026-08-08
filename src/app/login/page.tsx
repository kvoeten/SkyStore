/* eslint-disable @next/next/no-img-element -- the static SVG bypasses host-dependent image optimization inside Docker. */
import type { Route } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DiscordSignIn } from "@/components/discord-sign-in";
import { canonicalLoginUrl } from "@/lib/auth-url";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [{ returnTo }, requestHeaders] = await Promise.all([searchParams, headers()]);
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const target = canonicalLoginUrl(process.env.AUTH_URL, forwardedHost || requestHeaders.get("host"), returnTo);
  if (target) redirect(target as Route);
  return <main className="login"><section className="login-card panel"><img src="/brand/emblem.svg" alt="SkyStore merchant seal" width={80} height={80}/><p className="eyebrow">SKYSTORE</p><h1>Continue with Discord.</h1><p className="lede">Discord identifies your account for market reports and, if assigned, your store access.</p><DiscordSignIn returnTo={returnTo}/><p className="fine">SkyStore requests Discord&apos;s identity scope only. It does not request your email or server membership.</p><Link className="text-button" href="/guide">Return to the public price guide</Link></section></main>;
}
