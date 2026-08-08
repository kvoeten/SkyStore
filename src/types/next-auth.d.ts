import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      discordId?: string | null;
      globalRole: "user" | "platform_admin";
      quarantined: boolean;
      storeAccess: Array<{ storeId: string; role: "clerk" | "manager" | "owner"; trust: "unverified" | "verified" }>;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
