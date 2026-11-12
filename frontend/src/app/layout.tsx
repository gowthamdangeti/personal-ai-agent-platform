import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata: Metadata = {
  title: "Personal AI Agent Platform | Enterprise Multi-Agent OS",
  description:
    "Enterprise operating system for autonomous AI agents with human-in-the-loop governance and centralized BYOK credential management.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-[var(--bg-canvas)] text-[var(--text-primary)] font-sans antialiased selection:bg-[#7657F6]/30 selection:text-[#F1F3FA] h-full overflow-hidden">
        <ThemeProvider>
          <AuthProvider>
            <DashboardShell>{children}</DashboardShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
