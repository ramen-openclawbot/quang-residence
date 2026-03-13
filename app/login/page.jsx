"use client";

import { useState, useEffect } from "react";
import { useAuth, getHomeRoute } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { T } from "../../lib/tokens";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, profile, signInWithEmail } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && profile) router.replace(getHomeRoute(profile.role));
  }, [user, profile, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await signInWithEmail(email, password);
    if (err) {
      setError(err.message === "Invalid login credentials"
        ? "Incorrect email or password."
        : err.message
      );
    } else {
      router.replace("/");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: T.bg, fontFamily: T.font,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            backgroundColor: `${T.primary}10`, border: `2px solid ${T.primary}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 700, color: T.primary,
            margin: "0 auto 16px",
          }}>
            Z
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.text, marginBottom: 4, letterSpacing: "-0.02em" }}>
            ZenHome
          </h1>
          <p style={{ fontSize: 14, color: T.textMuted }}>
            Smart Household Management
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{
            backgroundColor: "#fff", borderRadius: 16, padding: 24,
            boxShadow: T.shadowMd, border: `1px solid ${T.primary}0d`,
          }}>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.12em", color: T.textMuted, marginBottom: 8,
            }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" required
              style={{
                width: "100%", padding: "14px 16px", fontSize: 16,
                border: `1px solid ${T.border}`, borderRadius: 10,
                outline: "none", backgroundColor: T.bg,
                fontFamily: T.font, color: T.text, boxSizing: "border-box",
              }}
            />

            <label style={{
              display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.12em", color: T.textMuted, marginTop: 16, marginBottom: 8,
            }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password" required
              style={{
                width: "100%", padding: "14px 16px", fontSize: 16,
                border: `1px solid ${T.border}`, borderRadius: 10,
                outline: "none", backgroundColor: T.bg,
                fontFamily: T.font, color: T.text, boxSizing: "border-box",
              }}
            />

            {error && (
              <div style={{
                marginTop: 12, padding: "10px 14px",
                backgroundColor: "#fef2f2", borderRadius: 8,
                fontSize: 13, color: T.danger,
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password} style={{
              width: "100%", marginTop: 20, padding: "14px 0",
              backgroundColor: loading ? T.textMuted : T.primary,
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
              boxShadow: `0 4px 12px ${T.primary}33`, fontFamily: T.font,
            }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: T.textMuted }}>
          Use the credentials provided by your administrator
        </p>
      </div>
    </div>
  );
}
