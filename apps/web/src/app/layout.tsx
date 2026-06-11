import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AppToaster } from "../components/ui/app-toaster";
import { DialogProvider } from "../components/ui/dialog-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  metadataBase: new URL("http://app.atlasone.local.gd"),
  title: {
    default: "Atlas One",
    template: "%s · Atlas One"
  },
  description: "WhatsApp, CRM, SDR e operação comercial em uma plataforma premium.",
  applicationName: "Atlas One",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" }
  ]
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('atlas-theme');var r=document.documentElement;if(t==='dark'){r.classList.add('dark');}else{r.classList.remove('dark');}}catch(e){}})();`
          }}
        />
      </head>
      <body>
        <DialogProvider>{children}</DialogProvider>
        <AppToaster />
      </body>
    </html>
  );
}
