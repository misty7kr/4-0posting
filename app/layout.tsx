import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "관독 4.0",
  description: "관리형독서실 네이버 블로그 콘텐츠 생성기",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
