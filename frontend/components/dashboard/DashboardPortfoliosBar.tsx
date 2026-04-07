"use client";

import Link from "next/link";
import { FormEvent } from "react";
import type { Portfolio } from "@/lib/api/client";

type Props = {
  portfolios: Portfolio[];
  newPortfolioName: string;
  onNewNameChange: (v: string) => void;
  onCreate: (e: FormEvent) => void;
  createLoading: boolean;
  createError: string | null;
};

export function DashboardPortfoliosBar({
  portfolios,
  newPortfolioName,
  onNewNameChange,
  onCreate,
  createLoading,
  createError
}: Props) {
  return (
    <section className="card stack" style={{ padding: "0.85rem 1rem" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "0.9rem" }}>Portfolios</strong>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {portfolios.length} account{portfolios.length === 1 ? "" : "s"}
        </span>
      </div>
      <form className="row" onSubmit={onCreate} style={{ flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="New portfolio name"
          value={newPortfolioName}
          onChange={(e) => onNewNameChange(e.target.value)}
          disabled={createLoading}
          style={{ flex: "1 1 180px", minWidth: 0 }}
        />
        <button type="submit" disabled={createLoading}>
          {createLoading ? "Creating…" : "Create"}
        </button>
      </form>
      {createError && <p className="error" style={{ margin: 0 }}>{createError}</p>}
      {portfolios.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          {portfolios.map((p) => (
            <Link
              key={p.id}
              href={`/portfolios/${p.id}`}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: 999,
                border: "1px solid var(--border)",
                fontSize: "0.82rem",
                fontWeight: 600,
                background: "rgba(255,255,255,0.03)"
              }}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
