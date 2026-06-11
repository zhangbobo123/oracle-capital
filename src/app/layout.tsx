import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "追光者 | Oracle Capital",
  description: "AI 驱动的多链投资决策与模拟执行平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
