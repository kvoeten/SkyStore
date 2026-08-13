import { signIn } from "@/auth";

function safeReturnTo(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/guide";
}

export function DiscordSignIn({ returnTo }: { returnTo?: string }) {
  const redirectTo = safeReturnTo(returnTo);
  return (
    <form action={async () => { "use server"; await signIn("discord", { redirectTo }); }}>
      <button className="button" type="submit">Continue with Discord</button>
    </form>
  );
}
