"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AUTH_TOKEN_CHANGE_EVENT, clearToken, getToken } from "@/lib/auth/token";

const navLinkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.45rem 0.75rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 500,
  color: "var(--text)",
  textDecoration: "none",
  transition: "all 0.15s ease",
  border: "1px solid transparent"
};

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function TradeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function NewsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={navLinkStyle}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(99, 216, 255, 0.1)";
        el.style.borderColor = "rgba(99, 216, 255, 0.3)";
        el.style.boxShadow = "0 0 12px rgba(99, 216, 255, 0.15)";
        el.style.color = "#9EEBFF";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "transparent";
        el.style.borderColor = "transparent";
        el.style.boxShadow = "none";
        el.style.color = "var(--text)";
      }}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setToken(getToken());

    function syncFromStorage() {
      setToken(getToken());
    }

    window.addEventListener(AUTH_TOKEN_CHANGE_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGE_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  return (
    <header
      style={{
        borderBottom: "1px solid rgba(47, 174, 255, 0.15)",
        background: "linear-gradient(180deg, rgba(4, 8, 18, 0.95) 0%, rgba(6, 12, 24, 0.9) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 1px 0 rgba(99, 216, 255, 0.05), 0 4px 30px rgba(0, 0, 0, 0.4)",
        position: "relative",
        zIndex: 100
      }}
    >
      <div
        className="container"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            textDecoration: "none",
            padding: "0.25rem 0",
          }}
        >
          {/* Brand mark */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "linear-gradient(135deg, rgba(99, 216, 255, 0.2) 0%, rgba(47, 174, 255, 0.1) 100%)",
              border: "1px solid rgba(99, 216, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 12px rgba(99, 216, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 800,
                background: "linear-gradient(180deg, #DDFBFF 0%, #63D8FF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              CH
            </span>
          </div>
          {/* Brand text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
                background: "linear-gradient(180deg, #DDFBFF 0%, #9EEBFF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1.1,
              }}
            >
              Colin Haluska
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: "rgba(99, 216, 255, 0.7)",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              Investments
            </span>
          </div>
        </Link>
        <nav className="row" style={{ gap: "0.25rem" }}>
          {isMounted && !token ? (
            <>
              <NavLink href="/login">Login</NavLink>
              <NavLink href="/register">Register</NavLink>
            </>
          ) : isMounted ? (
            <>
              <NavLink href="/dashboard">
                <HomeIcon /> Home
              </NavLink>
              <NavLink href="/trade">
                <TradeIcon /> Trade
              </NavLink>
              <NavLink href="/news">
                <NewsIcon /> News
              </NavLink>
              <button
                onClick={() => {
                  clearToken();
                  router.push("/login");
                }}
                style={{
                  ...navLinkStyle,
                  background: "transparent",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.background = "rgba(255, 107, 107, 0.1)";
                  el.style.borderColor = "rgba(255, 107, 107, 0.3)";
                  el.style.color = "#ff6b6b";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.background = "transparent";
                  el.style.borderColor = "transparent";
                  el.style.color = "var(--text)";
                }}
              >
                <LogoutIcon /> Logout
              </button>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
