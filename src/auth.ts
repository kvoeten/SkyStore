import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, isNull } from "drizzle-orm";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { db } from "@/db/runtime";
import { accounts, memberships, sessions, users, verificationTokens } from "@/db/schema";
import { bootstrapAdminStore } from "@/db/seed";

const discordClientId = process.env.AUTH_DISCORD_ID ?? "discord-client-not-configured";
const discordClientSecret = process.env.AUTH_DISCORD_SECRET ?? "discord-secret-not-configured";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens
  }),
  providers: [
    Discord({
      clientId: discordClientId,
      clientSecret: discordClientSecret,
      authorization: { params: { scope: "identify" } }
    })
  ],
  pages: { signIn: "/login" },
  session: { strategy: "database" },
  trustHost: true,
  callbacks: {
    async signIn({ user }) {
      if (!user.id) return false;
      const [record] = await db.select({ quarantinedAt: users.quarantinedAt }).from(users).where(eq(users.id, user.id)).limit(1);
      return !record?.quarantinedAt;
    },
    async session({ session, user }) {
      const [[record], storeAccess] = await Promise.all([
        db.select({ discordId: users.discordId, globalRole: users.globalRole, quarantinedAt: users.quarantinedAt }).from(users).where(eq(users.id, user.id)).limit(1),
        db.select({ storeId: memberships.storeId, role: memberships.role, trust: memberships.trust }).from(memberships).where(and(eq(memberships.userId, user.id), isNull(memberships.revokedAt)))
      ]);
      session.user.id = user.id;
      session.user.discordId = record?.discordId;
      session.user.globalRole = record?.globalRole ?? "user";
      session.user.quarantined = Boolean(record?.quarantinedAt);
      session.user.storeAccess = storeAccess;
      return session;
    }
  },
  events: {
    async linkAccount({ user, account }) {
      if (account.provider !== "discord" || !user.id) return;
      const isBootstrapAdmin = account.providerAccountId === process.env.SKYSTORE_ADMIN_DISCORD_ID;
      await db.update(users).set({
        discordId: account.providerAccountId,
        globalRole: isBootstrapAdmin ? "platform_admin" : "user",
        updatedAt: new Date()
      }).where(eq(users.id, user.id));
      if (isBootstrapAdmin) await bootstrapAdminStore(user.id);
    }
  }
});
