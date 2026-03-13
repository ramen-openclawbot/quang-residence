"use client";

import { useEffect } from "react";
import { useAuth, getHomeRoute } from "../lib/auth";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (profile) {
      router.replace(getHomeRoute(profile.role));
    }
  }, [user, profile, loading, router]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f6f8f6",
      fontFamily: "'Manrope', sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          backgroundColor: "#56c91d10", border: "2px solid #56c91d18",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, color: "#56c91d",
          margin: "0 auto 16px",
        }}>
          Z
        </div>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>Loading...</div>
      </div>
    </div>
  );
}
