import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Rolequiry",
  description: "공고만 보고는 잘 안 보이는 Job Fit을, 입사하기 전에 한번 더 확인합니다.",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
