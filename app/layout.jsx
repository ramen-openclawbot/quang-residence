import "./globals.css";
import { AuthProvider } from "../lib/auth";

export const metadata = {
  title: "ZenHome",
  description: "Quản lý tài chính gia đình thông minh",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#56c91d",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
