import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

/**
 * Noto Sans KR (files supplied in `public/fonts/NotoSans`), served by next/font with hashed, immutable URLs.
 * The UI uses 400/500/600/700; the family has no 600, so semibold text renders with the Bold face.
 */
const notoSansKr = localFont({
  src: [
    { path: "../../public/fonts/NotoSans/NotoSansKR-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/NotoSans/NotoSansKR-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/NotoSans/NotoSansKR-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TX TMS",
  description: "알림톡·문자·자유입력 콘텐츠 검수와 승인",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
