"use client";

import { useEffect } from "react";
import { useAuth, getHomeRoute } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { T } from "../../lib/tokens";

// Material Symbols icon helper
function MIcon({ name, size = 24, color, filled, style = {} }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        color,
        fontVariationSettings: filled
          ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
          : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export default function StaffShell({ children, role }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (profile && profile.role !== role) {
      router.replace(getHomeRoute(profile.role));
    }
  }, [user, profile, loading, role, router]);

  if (loading || !profile) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: T.bg, fontFamily: T.font,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: `3px solid ${T.primary}20`, borderTopColor: T.primary,
            animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
          }} />
          <div style={{ fontSize: 13, color: T.textMuted }}>Loading...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: T.bg, fontFamily: T.font,
      maxWidth: 430, margin: "0 auto", position: "relative",
      boxShadow: "0 0 60px rgba(0,0,0,0.06)",
    }}>
      <main style={{ paddingBottom: 84 }}>
        {children}
      </main>
    </div>
  );
}

export { MIcon };
