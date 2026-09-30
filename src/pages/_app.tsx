import type { AppProps } from "next/app";
import Head from "next/head";
import "@/styles/globals.css";
import { branding } from "@/config/branding";
import { brandThemeCss } from "@/config/branding/theme";

export default function App({ Component, pageProps }: AppProps) {
  const iconUrl = branding.iconUrl ?? branding.logoUrl;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{branding.appName}</title>
        <meta name="application-name" content={branding.appName} />
        <meta name="apple-mobile-web-app-title" content={branding.appShortName} />
        <meta name="theme-color" content={branding.secondaryColor} />
        <link rel="icon" href={branding.faviconUrl} sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" href={iconUrl} />
        <link rel="manifest" href="/api/manifest" />
        <style>{brandThemeCss(branding)}</style>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
