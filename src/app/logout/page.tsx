import Link from "next/link";
import { signOut } from "@/auth";

export default function LogoutPage() {
  return <main className="login"><section className="login-card panel">
    <p className="eyebrow">SKYSTORE ACCOUNT</p>
    <h1>Sign out</h1>
    <p className="lede">End this SkyStore session and return to the public price guide.</p>
    <form action={async () => { "use server"; await signOut({ redirectTo: "/guide?view=public" }); }}>
      <button className="button" type="submit">Sign out</button>
    </form>
    <Link className="text-button" href="/guide?view=public">Continue to the public guide</Link>
  </section></main>;
}
