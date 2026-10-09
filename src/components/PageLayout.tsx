"use client";

import { Header } from "./Header";

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
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      <header className="flex justify-between items-center py-3 sm:py-4 lg:py-5 px-3 sm:px-6 lg:px-12 shrink-0 border-b border-white/5">
        <Header asLink={showLogoAsLink} />
        {rightContent}
      </header>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
