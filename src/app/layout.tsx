import { Metadata, Viewport } from "next";
import "../../styles/global.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Swdbot - Motion Studio",
  description: "Swdbot - AI Prompt to Cinematic Motion Graphics",
  icons: {
    icon: "/swdbot-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden">
      <body className="bg-background h-full w-full overflow-hidden select-none">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
