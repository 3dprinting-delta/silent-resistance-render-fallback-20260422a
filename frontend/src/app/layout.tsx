import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "The Silent Resistance",
  description: "Slip into a living operation shell, adapt under pressure, and break the regime from inside the perimeter.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://silent-resistance-ops-20260402a.onrender.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
