import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

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
  return <html lang="en"><body>{children}</body></html>;
}
