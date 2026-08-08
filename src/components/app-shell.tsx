"use client";
/* eslint-disable @next/next/no-img-element -- the static SVG bypasses host-dependent image optimization inside Docker. */

import Link from "next/link";
import { useState, type ReactNode } from "react";

const links = [
  ["/guide", "Price guide", "◈"], ["/dashboard", "Store ledger", "⌂"], ["/inventory", "Inventory", "▦"],
  ["/record", "Record a Sale", "+"],
  ["/approvals", "Approvals", "✓"], ["/reports", "Reports", "⌁"], ["/store-admin", "Store settings", "⚙"],
  ["/platform", "Platform controls", "◆"], ["/catalog", "Catalog intake", "□"],
] as const;

export type ShellIdentity = { displayName?: string; role?: string; initials?: string; storeName?: string; storeId?: string; verified?: boolean };

export function AppShell({ children, current, identity, publicView = false, publicAccount = false, searchAction, searchStoreId, searchPublicView = false }: { children: ReactNode; current?: string; identity?: ShellIdentity; publicView?: boolean; publicAccount?: boolean; searchAction?: string; searchStoreId?: string; searchPublicView?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const account = identity?.displayName ?? "Signed-in account";
  const role = identity?.role ?? "Store access assigned by an administrator";
  const initials = identity?.initials ?? "SS";
  const realm = identity?.storeName ?? "ALLIANCE LEDGER";
  const effectiveSearchStoreId = searchStoreId ?? identity?.storeId;
  const visibleLinks = publicView ? links.slice(0, 1) : links;
  const primaryLinks = publicView ? links.slice(0, 1) : links.slice(0, 7);
  return <div className="app-shell"><a className="skip-link" href="#content">Skip to content</a>
    <aside className="sidebar" aria-label="Primary navigation">
      <Link href="/guide" className="brand"><img src="/brand/emblem.svg" alt="" width={36} height={36}/><span><strong>Sky</strong>Store<small>Merchant ledger</small></span></Link>
      <div className="realm">{publicView ? "PUBLIC PRICE GUIDE" : realm}{!publicView && <span>{identity?.verified ? "VERIFIED" : "PRIVATE"}</span>}</div>
      <nav className="nav-list">{visibleLinks.map(([href, label, icon]) => <Link key={href} href={href} aria-current={current === href ? "page" : undefined}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav>
      {publicView ? <div className="sidebar-foot">{publicAccount ? <><Link className="outline" href="/guide">Store view</Link><Link className="text-button" href="/logout">Sign out</Link></> : <Link className="outline" href="/login">Sign in</Link>}</div> : <div className="sidebar-foot"><span className="avatar">{initials}</span><span><b>{account}</b><small>{role}</small></span><span className="account-links"><Link href="/guide?view=public">Public</Link><Link href="/logout">Sign out</Link></span></div>}
    </aside>
    <header className="mobile-bar"><Link href="/guide" className="brand"><img src="/brand/emblem.svg" alt="" width={30} height={30}/><span><strong>Sky</strong>Store</span></Link><button className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen((open) => !open)}>Menu</button><nav id="mobile-nav" className={`mobile-nav ${menuOpen ? "open" : ""}`} aria-label="Mobile navigation">{primaryLinks.map(([href,label,icon]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}><span aria-hidden="true">{icon}</span>{label}</Link>)}{!publicView && <><Link href="/guide?view=public" onClick={() => setMenuOpen(false)}>Public price guide</Link><Link href="/logout" onClick={() => setMenuOpen(false)}>Sign out</Link></>}{publicView && publicAccount && <><Link href="/guide" onClick={() => setMenuOpen(false)}>Store view</Link><Link href="/logout" onClick={() => setMenuOpen(false)}>Sign out</Link></>}</nav></header>
    <main id="content" className="content"><header className="topbar"><form className="global-search" role="search" action={searchAction ?? "/guide"} method="get">{effectiveSearchStoreId && !publicView && <input type="hidden" name="storeId" value={effectiveSearchStoreId}/>} {searchPublicView && <input type="hidden" name="view" value="public"/>}<span aria-hidden="true">⌕</span><input name="q" type="search" placeholder="Search catalog and prices" aria-label="Search catalog and prices"/><kbd>Enter</kbd></form><div className="top-actions">{publicView ? publicAccount ? <><Link className="outline" href="/guide">Store view</Link><Link className="text-button" href="/logout">Sign out</Link></> : <Link className="outline" href="/login">Sign in</Link> : <><Link className="text-button" href="/guide?view=public">Public guide</Link><Link className="text-button" href="/logout">Sign out</Link></>}</div></header>{children}</main>
  </div>;
}

export function PageHeading({ eyebrow, title, children, actions }: { eyebrow: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) { return <div className="page-heading split"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</div>{actions && <div className="button-row">{actions}</div>}</div>; }
export function Status({ children, kind = "good" }: { children: ReactNode; kind?: "good" | "warn" | "pending" }) { return <span className={`pill ${kind}`}>{children}</span>; }
