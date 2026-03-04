import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "관리형독서실 4.0",
  description: "4.0 전용 블로그 포스팅 제작",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
