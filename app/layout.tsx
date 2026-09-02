import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "GitTrend Hub — 每日 GitHub 热点开源项目",
    template: "%s · GitTrend Hub",
  },
  description:
    "每天自动追踪 GitHub 热点开源项目，AI 智能归类，以卡片流呈现，支持按日期与分类筛选。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-[13px] font-black text-white">
                G
              </span>
              <span className="text-[15px] font-bold tracking-tight">
                GitTrend <span className="text-accent-strong">Hub</span>
              </span>
            </Link>
            <p className="hidden text-xs text-muted sm:block">
              每天 UTC 2:00 · 北京时间 10:00 自动更新
            </p>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line py-8 text-center text-xs text-muted">
          GitTrend Hub · Next.js + Supabase + GitHub Actions · 数据来自 GitHub 公开
          API
        </footer>
      </body>
    </html>
  );
}
