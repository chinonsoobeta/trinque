import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import { ToastProvider } from "@/components/ToastProvider";
import "./tokens.css";
import "./base.css";
import "./components.css";

/**
 * next/font downloads both faces at build time and serves them from our own
 * origin, so there is no request to Google at runtime and no flash of fallback
 * text. The CSS variables are consumed by --font-display / --font-ui in
 * tokens.css rather than by components directly.
 */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
const ui = Inter({ subsets: ["latin"], variable: "--font-ui-face", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = protocol + "://" + host;
  const title = "Trinque — Find dishes with friends";
  const description = "Find dishes you like, see similar food nearby, and plan meals with friends.";
  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: { title, description, type: "website", url: baseUrl, siteName: "Trinque", images: [{ url: baseUrl + "/og.png", width: 1732, height: 907, alt: "Trinque — Find dishes with friends" }] },
    twitter: { card: "summary_large_image", title, description, images: [baseUrl + "/og.png"] },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Trinque" },
    formatDetection: { telephone: false },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeBootstrap = `(function(){try{var p=localStorage.getItem('trinque.theme')||'system';if(!/^(system|light|dark)$/.test(p))p='system';var d=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=d;document.documentElement.dataset.themePreference=p}catch(_){}})()`;
  // The worker caches HTML and static chunks, which in development means it
  // serves the previous build's markup for a chunk URL that no longer exists —
  // so it registers in production and tears itself down everywhere else.
  const serviceWorker = process.env.NODE_ENV === "production"
    ? `(function(){if('serviceWorker'in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})})()`
    : `(function(){if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()})}).catch(function(){})})()`;
  return <html lang="en-CA" className={`${display.variable} ${ui.variable}`} suppressHydrationWarning><head><meta name="theme-color" content="#7a263a" /><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><link rel="icon" href="/favicon.svg" type="image/svg+xml" /><link rel="apple-touch-icon" href="/icon-192.png" /><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /><script dangerouslySetInnerHTML={{ __html: serviceWorker }} /></head><body><AuthProvider><PreferencesProvider><ToastProvider><AppShell>{children}</AppShell></ToastProvider></PreferencesProvider></AuthProvider></body></html>;
}
