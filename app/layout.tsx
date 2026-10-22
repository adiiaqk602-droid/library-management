import "./globals.css";
import type { ReactNode } from "react";
export const metadata = { title: "Dr A Q Khan Library System", description: "Central library management system" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
