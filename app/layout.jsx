import "./globals.css";
import { AuthProvider } from "../lib/auth";
import ChatInbox from "../components/chat/ChatInbox";

export const metadata = {
  title: "ZenHome",
  description: "Quản lý gia đình thông minh",
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
        {/* Preconnect to Google Fonts CDN — eliminates DNS+TLS latency */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preload font CSS to start download earlier in the waterfall */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap"
          as="style"
        />
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          as="style"
        />
      </head>
      <body>
        <AuthProvider>
          {children}
          <ChatInbox />
        </AuthProvider>
      </body>
    </html>
  );
}
