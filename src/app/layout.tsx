import type { Metadata } from "next";
import "./globals.css";
import "./market.css";
import "./account.css";

export const metadata: Metadata = {
  title: "SkyStore · Merchant Ledger",
  description: "Merchant price records and public market intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
