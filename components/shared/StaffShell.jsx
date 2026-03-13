"use client";

import { useEffect } from "react";
import { useAuth, getHomeRoute } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { T, flexBetween, flexCenter } from "../../lib/tokens";
import { BellIcon, LogOutIcon } from "./Icons";

// Wrapper for all role-based pages — handles auth guard + header + bottom nav
export default function StaffShell({ children, title, tabs, activeTab, onTabChange, role }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile && profile.role !== role) {
      router.replace(getHomeRoute(profile.role));
    }
  }, [user, profile, loading, role, router]);

  if (loading || !profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: T.bg, fontFamily: T.font }}>
        <div style={{ fontSize: 14, color: T.textMuted }}>Đang tải...</div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: T.bg, fontFamily: T.font,
      maxWidth: 430, margin: "0 auto", position: "relative",
      boxShadow: "0 0 60px rgba(0,0,0,0.08)",
    }}>
      {/* Header */}
      <header style={{ ...flexBetween, padding: "28px 24px 16px" }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, fontWeight: 600 }}>
            {profile.full_name}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>
            {title}
          </div>
        </div>
        <div style={{ ...flexCenter, gap: 8 }}>
          <button style={{ width: 36, height: 36, borderRadius: "50%", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BellIcon size={20} color={T.text} />
          </button>
          <button onClick={handleLogout} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOutIcon size={18} color={T.textMuted} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ paddingBottom: 84 }}>
        {children}
      </main>

      {/* Bottom Nav */}
      {tabs && tabs.length > 0 && (
        <nav style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430,
          backgroundColor: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
          borderTop: `1px solid ${T.border}`,
          padding: "10px 16px 22px", zIndex: 50,
        }}>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => onTabChange(t.id)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 3, border: "none", backgroundColor: "transparent",
                  cursor: "pointer", padding: "4px 12px", minWidth: 56,
                }}>
                  <t.Ic size={20} color={active ? T.primary : T.textMuted} />
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.06em", color: active ? T.primary : T.textMuted,
                  }}>{t.label}</span>
                  {active && <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: T.primary }} />}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
