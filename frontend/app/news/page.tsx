"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { api, NewsCategory, NewsArticle } from "@/lib/api/client";
import { getToken } from "@/lib/auth/token";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const cardStyle: CSSProperties = {
  background: "linear-gradient(165deg, rgba(13, 28, 53, 0.95) 0%, rgba(8, 26, 51, 0.98) 100%)",
  border: "1px solid rgba(47, 174, 255, 0.2)",
  borderRadius: 12,
  padding: "1.25rem",
  boxShadow: "inset 0 1px 0 rgba(158, 235, 255, 0.08), 0 0 30px rgba(99, 216, 255, 0.08), 0 4px 24px rgba(0, 0, 0, 0.3)"
};

const articleStyle: CSSProperties = {
  display: "block",
  padding: "1rem",
  background: "rgba(99, 216, 255, 0.02)",
  borderRadius: 8,
  border: "1px solid rgba(47, 174, 255, 0.12)",
  textDecoration: "none",
  color: "inherit",
  transition: "all 0.15s ease"
};

function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

function NewsArticleCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={articleStyle}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(99, 216, 255, 0.06)";
        el.style.borderColor = "rgba(99, 216, 255, 0.25)";
        el.style.boxShadow = "0 0 15px rgba(99, 216, 255, 0.1)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(99, 216, 255, 0.02)";
        el.style.borderColor = "rgba(47, 174, 255, 0.12)";
        el.style.boxShadow = "none";
      }}
    >
      <div className="stack" style={{ gap: "0.5rem" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
          <span style={{ fontSize: "0.95rem", fontWeight: 600, lineHeight: 1.35 }}>
            {article.title}
          </span>
          {article.image_url && (
            <img
              src={article.image_url}
              alt=""
              style={{
                width: 80,
                height: 56,
                objectFit: "cover",
                borderRadius: 6,
                flexShrink: 0
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
        {article.summary && (
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.45 }}>
            {article.summary.length > 150 ? article.summary.slice(0, 150) + "..." : article.summary}
          </p>
        )}
        <div className="row" style={{ gap: "0.75rem", fontSize: "0.75rem" }}>
          <span style={{ color: "#63D8FF", fontWeight: 500 }}>{article.source}</span>
          <span className="muted">{formatTimeAgo(article.published_at)}</span>
        </div>
      </div>
    </a>
  );
}

function NewsCategorySection({ category }: { category: NewsCategory }) {
  if (category.articles.length === 0) return null;

  return (
    <div style={cardStyle}>
      <div className="stack" style={{ gap: "1rem" }}>
        <div className="stack" style={{ gap: "0.25rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#9EEBFF" }}>
            {category.display_name}
          </h2>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            {category.articles.length} articles
          </span>
        </div>
        <div className="stack" style={{ gap: "0.75rem" }}>
          {category.articles.map((article, idx) => (
            <NewsArticleCard key={`${category.category}-${idx}`} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}

function formatLastUpdated(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function NewsPage() {
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getNews();
      setCategories(response.categories);
      setLastUpdated(response.last_updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load news");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

  const totalArticles = categories.reduce((sum, cat) => sum + cat.articles.length, 0);

  return (
    <ProtectedRoute>
      <div className="stack" style={{ gap: "1.25rem", paddingTop: "1rem", paddingBottom: "2rem" }}>
        <div className="stack" style={{ gap: "0.5rem" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#9EEBFF" }}>Market News</h1>
            {lastUpdated && !loading && (
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                Updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            {loading ? "Loading..." : `${totalArticles} articles across ${categories.length} topics`}
          </p>
        </div>

        {loading && (
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "3rem 2rem"
              }}
            >
              <span className="muted">Loading market news...</span>
            </div>
          </div>
        )}

        {error && (
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
                flexDirection: "column",
                gap: "1rem"
              }}
            >
              <p className="error" style={{ margin: 0 }}>{error}</p>
              <button onClick={() => void loadNews()}>Retry</button>
            </div>
          </div>
        )}

        {!loading && !error && totalArticles === 0 && (
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "3rem 2rem",
                flexDirection: "column",
                gap: "1rem",
                textAlign: "center"
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(99, 216, 255, 0.4)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8" />
                <path d="M15 18h-5" />
                <path d="M10 6h8v4h-8V6Z" />
              </svg>
              <div className="stack" style={{ gap: "0.35rem" }}>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "#9EEBFF" }}>
                  No News Available
                </span>
                <span className="muted" style={{ fontSize: "0.85rem", maxWidth: 320 }}>
                  Configure a news API key (NEWSAPI_KEY or FINNHUB_API_KEY) to enable live market news.
                </span>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && categories.map((category) => (
          <NewsCategorySection key={category.category} category={category} />
        ))}
      </div>
    </ProtectedRoute>
  );
}
