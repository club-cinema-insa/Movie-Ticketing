import { type Metadata } from "next";

import { TRPCReactProvider } from "@/trpc/react";
import { branding } from "@/config/branding";

export const metadata: Metadata = {
  title: branding.appName,
  description: branding.tagline ?? branding.appName,
  icons: [{ rel: "icon", url: branding.faviconUrl }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
