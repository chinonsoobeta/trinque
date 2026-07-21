import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";
import "./social.css";
import "./unified.css";

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
  const serviceWorker = `(function(){if('serviceWorker'in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})})()`;
  return <html lang="en-CA" suppressHydrationWarning><head><meta name="theme-color" content="#7a263a" /><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /><script dangerouslySetInnerHTML={{ __html: serviceWorker }} /></head><body><AuthProvider><AppShell>{children}</AppShell></AuthProvider></body></html>;
}
