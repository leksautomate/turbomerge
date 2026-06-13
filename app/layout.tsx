import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TurboBatch",
  description: "Bulk AI media generator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[hsl(220_20%_7%)] text-[hsl(40_15%_90%)] flex" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
        <aside className="w-56 shrink-0 border-r border-[hsl(220_15%_16%)] flex flex-col min-h-screen bg-[hsl(220_18%_8%)]">
          <div className="px-5 py-5 border-b border-[hsl(220_15%_16%)]">
            <span className="font-bold text-lg tracking-tight text-[hsl(38_55%_55%)]" style={{ fontFamily: "'Cinzel', serif" }}>
              TurboBatch
            </span>
          </div>
          <nav className="flex flex-col gap-1 p-3 flex-1">
            <Link
              href="/"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[hsl(40_15%_70%)] hover:bg-[hsl(220_15%_15%)] hover:text-[hsl(40_15%_90%)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path d="M1 2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm8 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V2zM1 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-4zm8 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-4z"/>
              </svg>
              Dashboard
            </Link>
            <Link
              href="/projects/new"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[hsl(40_15%_70%)] hover:bg-[hsl(220_15%_15%)] hover:text-[hsl(40_15%_90%)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
              </svg>
              New Project
            </Link>
          </nav>
          <div className="p-3 border-t border-[hsl(220_15%_16%)]">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[hsl(40_15%_70%)] hover:bg-[hsl(220_15%_15%)] hover:text-[hsl(40_15%_90%)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
              </svg>
              Settings
            </Link>
          </div>
        </aside>
        <main className="flex-1 min-h-screen overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
