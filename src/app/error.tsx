"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="login"><section className="login-card panel">
    <p className="eyebrow">SKYSTORE</p>
    <h1>This page could not load.</h1>
    <p className="lede">You can retry, return to the public price guide, or sign out without relying on the failed page.</p>
    <div className="button-row" style={{ justifyContent: "center" }}>
      <button className="button" type="button" onClick={reset}>Try again</button>
      <a className="outline" href="/guide?view=public">Public price guide</a>
      <a className="text-button" href="/logout">Sign out</a>
    </div>
  </section></main>;
}
