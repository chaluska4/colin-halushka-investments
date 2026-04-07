"use client";

import type { ReactNode } from "react";
import { SciFiFinanceBackground } from "@/components/auth/SciFiFinanceBackground";

export function AuthScreenLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        marginLeft: "-1.25rem",
        marginRight: "-1.25rem",
        paddingLeft: "1.25rem",
        paddingRight: "1.25rem",
        paddingTop: "2rem",
        paddingBottom: "2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        isolation: "isolate",
      }}
    >
      <SciFiFinanceBackground />
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440 }}>
        {children}
      </div>
    </div>
  );
}
