"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="card stack" style={{ maxWidth: 640, margin: "2rem auto" }}>
      <h2 style={{ margin: 0 }}>Something went wrong</h2>
      <p className="muted" style={{ margin: 0 }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="row">
        <button onClick={reset} type="button">
          Try again
        </button>
      </div>
    </div>
  );
}
