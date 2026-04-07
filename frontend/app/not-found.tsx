import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="card stack" style={{ maxWidth: 640, margin: "2rem auto" }}>
      <h2 style={{ margin: 0 }}>Page not found</h2>
      <p className="muted" style={{ margin: 0 }}>
        The page you are looking for does not exist.
      </p>
      <div className="row">
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.65rem 0.8rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "#fff",
            background: "#4f7cff",
            border: "1px solid transparent",
            borderRadius: 8,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
