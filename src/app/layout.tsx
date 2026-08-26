import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";
import { DEFAULT_UI_STYLE, UI_STYLE_STORAGE_KEY } from "@/lib/ui-style";

// Applied before paint so a stored theme never flashes the default palette.
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t)document.documentElement.dataset.theme=t;}catch(e){}})()`;
const uiStyleScript = `(function(){try{var u=localStorage.getItem(${JSON.stringify(
  UI_STYLE_STORAGE_KEY,
)});if(u)document.documentElement.dataset.ui=u;}catch(e){}})()`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "スカイネット — 映画人生をつくる場所",
  description:
    "自分の映画棚を育てながら、映画の好みを Cinema DNA として可視化し、まだ観ていない映画の自分専用スコアを予測する映画プラットフォーム、スカイネット。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "スカイネット" },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-theme={DEFAULT_THEME} data-ui={DEFAULT_UI_STYLE}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: uiStyleScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} grain antialiased`}>{children}</body>
    </html>
  );
}
