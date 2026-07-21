import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { AppFrame } from "@/components/AppFrame";
import { AuthProvider } from "@/components/AuthProvider";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const display = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f0e7" },
    { media: "(prefers-color-scheme: dark)", color: "#171313" },
  ],
  width: "device-width",
  initialScale: 1,
};
import "./globals.css";
import "./social.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = protocol + "://" + host;
  const title = "Trinque — Good food finds good company";
  const description = "AI-powered dish discovery, nearby matches, and group dining plans built with GPT-5.6 and Codex.";
  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: { title, description, type: "website", url: baseUrl, siteName: "Trinque", images: [{ url: baseUrl + "/og.png", width: 1732, height: 907, alt: "Trinque — Good food finds good company" }] },
    twitter: { card: "summary_large_image", title, description, images: [baseUrl + "/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeBootstrap = `(function(){try{var p=localStorage.getItem('trinque.theme')||'system';if(!/^(system|light|dark)$/.test(p))p='system';var d=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=d;document.documentElement.dataset.themePreference=p}catch(_){}})()`;
  return <html lang="en-CA" className={`bg-background ${sans.variable} ${display.variable}`} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body className="font-sans"><AuthProvider><AppFrame>{children}</AppFrame></AuthProvider></body></html>;
}
