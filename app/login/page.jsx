"use client";

import { useState, useEffect } from "react";
import { useAuth, getHomeRoute } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { T } from "../../lib/tokens";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, profile, signInWithEmail } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile) {
      router.replace(getHomeRoute(profile.role));
    }
  }, [user, profile, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = await signInWithEmail(email);
    if (err) {
      setError(err.message === "Signups not allowed for otp"
        ? "Email chưa được đăng ký trong hệ thống. Vui lòng liên hệ Mr. Quang."
        : err.message
      );
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: T.bg,
      fontFamily: T.font,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            backgroundColor: T.primaryBg, border: `2px solid ${T.primaryBg2}`,
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
            Quản lý gia đình thông minh
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <div style={{
              backgroundColor: T.card,
              borderRadius: 16,
              padding: 24,
              boxShadow: T.shadowMd,
              border: `1px solid ${T.borderLight}`,
            }}>
              <label style={{
                display: "block",
                fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.12em", color: T.textLabel, marginBottom: 8,
              }}>
                Email đăng nhập
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                style={{
                  width: "100%", padding: "14px 16px", fontSize: 16,
                  border: `1px solid ${T.border}`, borderRadius: 10,
                  outline: "none", backgroundColor: T.bg,
                  fontFamily: T.font, color: T.text,
                  boxSizing: "border-box",
                }}
              />

              {error && (
                <div style={{
                  marginTop: 12, padding: "10px 14px",
                  backgroundColor: T.dangerBg, borderRadius: 8,
                  fontSize: 13, color: T.danger,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: "100%", marginTop: 20, padding: "14px 0",
                  backgroundColor: loading ? T.textMuted : T.primary,
                  color: T.white, border: "none", borderRadius: 10,
                  fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
                  boxShadow: `0 4px 12px ${T.primary}33`,
                  fontFamily: T.font,
                }}
              >
                {loading ? "Đang gửi..." : "Gửi link đăng nhập"}
              </button>
            </div>
          </form>
        ) : (
          <div style={{
            backgroundColor: T.card,
            borderRadius: 16,
            padding: 32,
            boxShadow: T.shadowMd,
            border: `1px solid ${T.borderLight}`,
            textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              backgroundColor: T.greenBg, display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", fontSize: 28,
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              Kiểm tra email
            </h2>
            <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6 }}>
              Đã gửi link đăng nhập đến <strong style={{ color: T.text }}>{email}</strong>.
              Nhấn vào link trong email để vào app.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              style={{
                marginTop: 20, padding: "10px 20px",
                backgroundColor: "transparent", color: T.primary,
                border: `1px solid ${T.primaryBg2}`, borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              Dùng email khác
            </button>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: T.textMuted }}>
          Chỉ các tài khoản đã được đăng ký mới có thể đăng nhập
        </p>
      </div>
    </div>
  );
}
