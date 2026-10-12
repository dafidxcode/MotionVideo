/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

interface HeaderProps {
  asLink?: boolean;
}

export function Header({ asLink = false }: HeaderProps) {
  const content = (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <img
        src="/swdbot-logo.png"
        alt="Swdbot"
        className="w-7 h-7 sm:w-9 sm:h-9 object-contain"
      />
      <span className="text-base sm:text-xl font-bold text-white font-sans tracking-tight">
        Swdbot Motion
      </span>
    </div>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        className="flex items-center hover:opacity-80 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}
