"use client";

import { Header } from "./Header";
import { UserHeaderProfile } from "./UserHeaderProfile";

interface PageLayoutProps {
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  showLogoAsLink?: boolean;
}

export function PageLayout({
  children,
  rightContent,
  showLogoAsLink = false,
}: PageLayoutProps) {
  return (
    <div className="fixed inset-0 h-full w-full bg-background flex flex-col overflow-hidden">
      <header className="flex justify-between items-center py-2.5 sm:py-3 px-3 sm:px-6 lg:px-10 shrink-0 border-b border-[#28282C] bg-[#0A0A0B]/90 backdrop-blur-md z-20">
        <Header asLink={showLogoAsLink} />
        <div className="flex items-center gap-2 sm:gap-3">
          {rightContent}
          <UserHeaderProfile />
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        {children}
      </main>
    </div>
  );
}
