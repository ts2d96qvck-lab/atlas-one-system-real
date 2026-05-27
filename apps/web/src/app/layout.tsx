import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("http://app.atlasone.local.gd"),
  title: {
    default: "Atlas One",
    template: "%s · Atlas One"
  },
  description: "WhatsApp, CRM, SDR e operacao comercial em uma plataforma premium.",
  applicationName: "Atlas One",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('atlas-theme');var r=document.documentElement;if(t==='dark'){r.classList.add('dark');}else{r.classList.remove('dark');}}catch(e){}})();`
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
