"use client";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0f15", color: "#e5e7eb", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
        <main style={{ maxWidth: 640, margin: "2rem auto", padding: "1.25rem" }}>
          <div
            style={{
              background: "linear-gradient(180deg, #10161f 0%, #121a24 100%)",
              border: "1px solid #1f2937",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Application error</h2>
            <p style={{ color: "#98a2b3" }}>
              {error.message || "A critical error occurred."}
            </p>
            <button
              onClick={reset}
              type="button"
              style={{
                border: "1px solid transparent",
                borderRadius: 8,
                padding: "0.65rem 0.8rem",
                fontSize: "0.95rem",
                color: "#fff",
                background: "#4f7cff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
