"use client";

import type { CSSProperties } from "react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { api } from "@/lib/api/client";

const cardStyle: CSSProperties = {
  position: "relative",
  background: "linear-gradient(165deg, rgba(8, 20, 40, 0.85) 0%, rgba(6, 16, 32, 0.9) 100%)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(99, 216, 255, 0.15)",
  borderRadius: 16,
  padding: "2rem",
  boxShadow: `
    0 0 0 1px rgba(255, 200, 87, 0.05),
    inset 0 1px 0 rgba(221, 251, 255, 0.08),
    0 0 60px rgba(47, 174, 255, 0.08),
    0 25px 50px rgba(0, 0, 0, 0.5)
  `,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.85rem 1rem",
  fontSize: "0.95rem",
  color: "#e8f4f8",
  background: "rgba(6, 13, 26, 0.7)",
  border: "1px solid rgba(47, 174, 255, 0.2)",
  borderRadius: 10,
  outline: "none",
  transition: "all 0.2s ease",
};

const buttonStyle: CSSProperties = {
  width: "100%",
  padding: "0.9rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
  color: "#030810",
  background: "linear-gradient(180deg, #9EEBFF 0%, #63D8FF 50%, #2FAEFF 100%)",
  border: "1px solid rgba(221, 251, 255, 0.4)",
  borderRadius: 10,
  cursor: "pointer",
  boxShadow: `
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 0 20px rgba(99, 216, 255, 0.3),
    0 0 40px rgba(47, 174, 255, 0.15)
  `,
  transition: "all 0.2s ease",
  textShadow: "0 1px 0 rgba(255, 255, 255, 0.2)",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "0.4rem",
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "rgba(158, 235, 255, 0.8)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await api.register(email.trim(), password);
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout>
      <div style={cardStyle}>
        {/* Accent line at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(99, 216, 255, 0.5), rgba(255, 200, 87, 0.5), transparent)",
            borderRadius: "0 0 2px 2px",
          }}
        />

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.6rem",
              fontWeight: 700,
              background: "linear-gradient(180deg, #DDFBFF 0%, #9EEBFF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Create Account
          </h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#7eb8d4" }}>
            Join the future of paper trading
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
        >
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(99, 216, 255, 0.5)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 216, 255, 0.1), 0 0 20px rgba(99, 216, 255, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(47, 174, 255, 0.2)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(99, 216, 255, 0.5)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 216, 255, 0.1), 0 0 20px rgba(99, 216, 255, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(47, 174, 255, 0.2)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(99, 216, 255, 0.5)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 216, 255, 0.1), 0 0 20px rgba(99, 216, 255, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(47, 174, 255, 0.2)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {error && (
            <p
              style={{
                margin: 0,
                padding: "0.6rem 0.8rem",
                fontSize: "0.85rem",
                color: "#ff6b6b",
                background: "rgba(255, 107, 107, 0.1)",
                border: "1px solid rgba(255, 107, 107, 0.2)",
                borderRadius: 8,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle,
              marginTop: "0.5rem",
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = `
                  inset 0 1px 0 rgba(255, 255, 255, 0.4),
                  0 0 30px rgba(99, 216, 255, 0.4),
                  0 0 60px rgba(47, 174, 255, 0.2)
                `;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `
                inset 0 1px 0 rgba(255, 255, 255, 0.3),
                0 0 20px rgba(99, 216, 255, 0.3),
                0 0 40px rgba(47, 174, 255, 0.15)
              `;
            }}
          >
            {loading ? "Creating Account..." : "Initialize Account"}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#7eb8d4" }}>
            Already have an account?{" "}
            <Link
              href="/login"
              style={{
                color: "#9EEBFF",
                fontWeight: 500,
                textDecoration: "none",
                borderBottom: "1px solid rgba(158, 235, 255, 0.3)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#DDFBFF";
                e.currentTarget.style.borderBottomColor = "rgba(221, 251, 255, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#9EEBFF";
                e.currentTarget.style.borderBottomColor = "rgba(158, 235, 255, 0.3)";
              }}
            >
              Sign In
            </Link>
          </p>
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "20%",
            right: "20%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(99, 216, 255, 0.3), transparent)",
          }}
        />
      </div>
    </AuthScreenLayout>
  );
}
