import type { Metadata } from "next";
import "./globals.css";
import DashboardLayout from "@/components/ui/Layout/DashboardLayout";

export const metadata: Metadata = {
  title: "HydroSense Enterprise Dashboard",
  description: "Predictive Maintenance for Hydraulic Systems",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DashboardLayout>{children}</DashboardLayout>
      </body>
    </html>
  );
}
