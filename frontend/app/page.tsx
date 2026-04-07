"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";

const cardStyle: CSSProperties = {
  position: "relative",
  background: "linear-gradient(165deg, rgba(8, 20, 40, 0.85) 0%, rgba(6, 16, 32, 0.9) 100%)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(99, 216, 255, 0.15)",
  borderRadius: 16,
  padding: "2.5rem 2rem",
  boxShadow: `
    0 0 0 1px rgba(255, 200, 87, 0.05),
    inset 0 1px 0 rgba(221, 251, 255, 0.08),
    0 0 60px rgba(47, 174, 255, 0.08),
    0 25px 50px rgba(0, 0, 0, 0.5)
  `,
};

const primaryButtonStyle: CSSProperties = {
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

const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  padding: "0.9rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
  color: "#9EEBFF",
  background: "transparent",
  border: "1px solid rgba(99, 216, 255, 0.3)",
  borderRadius: 10,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

export default function HomePage() {
  const router = useRouter();
  const [primaryHover, setPrimaryHover] = useState(false);
  const [secondaryHover, setSecondaryHover] = useState(false);

  return (
    <AuthScreenLayout>
      <div style={cardStyle}>
        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255, 200, 87, 0.5), rgba(99, 216, 255, 0.5), transparent)",
            borderRadius: "0 0 2px 2px",
          }}
        />

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              fontWeight: 700,
              background: "linear-gradient(180deg, #DDFBFF 0%, #9EEBFF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Colin Haluska Investments
          </h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#7eb8d4" }}>
            Your personal paper trading terminal
          </p>
          <p style={{ margin: "1rem 0 0", fontSize: "0.85rem", color: "rgba(126, 184, 212, 0.65)", lineHeight: 1.6 }}>
            Track portfolios. Execute trades. Own your financial future.
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{
              ...primaryButtonStyle,
              ...(primaryHover ? {
                transform: "translateY(-1px)",
                boxShadow: `
                  inset 0 1px 0 rgba(255, 255, 255, 0.4),
                  0 0 30px rgba(99, 216, 255, 0.4),
                  0 0 60px rgba(47, 174, 255, 0.2)
                `,
              } : {}),
            }}
            onMouseEnter={() => setPrimaryHover(true)}
            onMouseLeave={() => setPrimaryHover(false)}
          >
            Access Terminal
          </button>

          <button
            type="button"
            onClick={() => router.push("/register")}
            style={{
              ...secondaryButtonStyle,
              ...(secondaryHover ? {
                background: "rgba(99, 216, 255, 0.08)",
                border: "1px solid rgba(99, 216, 255, 0.55)",
              } : {}),
            }}
            onMouseEnter={() => setSecondaryHover(true)}
            onMouseLeave={() => setSecondaryHover(false)}
          >
            Initialize Account
          </button>
        </div>

        {/* Bottom accent line */}
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
