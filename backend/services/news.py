"""
News service with pluggable providers.

Supports fetching market/finance news from external APIs.
Falls back to empty results when no API key is configured.
"""

import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import httpx


@dataclass
class NewsArticle:
    """Normalized news article."""
    title: str
    source: str
    summary: str
    url: str
    published_at: str
    category: str
    image_url: Optional[str] = None


def _normalize_source(source: str) -> str:
    return source.lower().strip()


def _diversify_sources(candidates: list["NewsArticle"], limit: int) -> list["NewsArticle"]:
    """
    Select up to `limit` articles preferring at most one per source.
    Falls back to repeats only when not enough unique sources exist.
    """
    source_counts: dict[str, int] = {}
    first_pass: list[NewsArticle] = []
    overflow: list[NewsArticle] = []

    for article in candidates:
        key = _normalize_source(article.source)
        if source_counts.get(key, 0) < 1:
            first_pass.append(article)
            source_counts[key] = 1
        else:
            overflow.append(article)

    result = first_pass[:limit]
    if len(result) < limit:
        result += overflow[:limit - len(result)]
    return result


class NewsProvider(ABC):
    """Abstract base class for news providers."""

    @abstractmethod
    def get_news(self, category: str, limit: int = 10) -> list[NewsArticle]:
        """Get news articles for a category."""
        pass

    @abstractmethod
    def get_all_categories(self) -> list[str]:
        """Get list of supported categories."""
        pass


class FinnhubNewsProvider(NewsProvider):
    """
    Finnhub news provider.
    Uses the general news endpoint with keyword filtering per category.
    Optimized for free tier with 15-minute caching.
    """

    BASE_URL = "https://finnhub.io/api/v1"

    # Keywords to filter articles by category
    CATEGORY_KEYWORDS = {
        "top": [],  # No filter - takes top headlines
        "energy": [
            "oil", "energy", "opec", "crude", "petroleum", "gas", "lng",
            "renewable", "solar", "wind", "power", "utility", "exxon",
            "chevron", "shell", "bp", "drilling", "pipeline", "fuel"
        ],
        "geopolitics": [
            "china", "russia", "ukraine", "war", "sanctions", "tariff",
            "trade war", "nato", "military", "conflict", "treaty", "biden",
            "trump", "congress", "fed", "federal reserve", "inflation",
            "recession", "geopolitical", "diplomatic", "election"
        ],
        "stocks": [
            "earnings", "stock", "shares", "ipo", "merger", "acquisition",
            "buyback", "dividend", "ceo", "quarterly", "revenue", "profit",
            "nasdaq", "dow", "s&p", "nyse", "trading", "investor", "analyst",
            "upgrade", "downgrade", "target price", "buy rating", "sell rating"
        ],
    }

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._raw_cache: Optional[tuple[list[dict], float]] = None
        self._category_cache: dict[str, tuple[list[NewsArticle], float]] = {}
        self._cache_ttl = 900  # 15 minutes
        self._used_urls: set[str] = set()
        self._last_fetch_time: float = 0

    def _get(self, endpoint: str, params: dict = None) -> Optional[list]:
        params = params or {}
        params["token"] = self.api_key
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.BASE_URL}{endpoint}", params=params)
                if resp.status_code == 200:
                    return resp.json()
                return None
        except Exception:
            return None

    def _fetch_raw_news(self) -> list[dict]:
        """Fetch and cache raw news from Finnhub."""
        now = time.time()

        # Check raw cache
        if self._raw_cache:
            cached_data, cached_at = self._raw_cache
            if now - cached_at < self._cache_ttl:
                return cached_data

        # Fetch fresh data
        data = self._get("/news", {"category": "general"})
        if not data:
            return []

        self._raw_cache = (data, now)
        self._last_fetch_time = now
        # Reset used URLs when fetching fresh data
        self._used_urls = set()
        return data

    def _matches_category(self, item: dict, category: str) -> bool:
        """Check if an article matches the category keywords."""
        keywords = self.CATEGORY_KEYWORDS.get(category, [])
        if not keywords:
            return True  # No keywords means accept all (for "top")

        text = (
            (item.get("headline", "") or "") + " " +
            (item.get("summary", "") or "")
        ).lower()

        return any(kw.lower() in text for kw in keywords)

    def get_news(self, category: str, limit: int = 3) -> list[NewsArticle]:
        cache_key = f"{category}:{limit}"
        now = time.time()

        # Check category cache
        if cache_key in self._category_cache:
            cached, cached_at = self._category_cache[cache_key]
            if now - cached_at < self._cache_ttl:
                return cached

        # Fetch raw news (cached)
        raw_data = self._fetch_raw_news()
        if not raw_data:
            return []

        # Collect candidates without marking used yet — diversification selects final set
        candidates: list[NewsArticle] = []
        fetch_target = limit * 6
        for item in raw_data:
            if len(candidates) >= fetch_target:
                break
            url = item.get("url", "")
            if url in self._used_urls:
                continue
            if not self._matches_category(item, category):
                continue
            candidates.append(NewsArticle(
                title=item.get("headline", ""),
                source=item.get("source", ""),
                summary=item.get("summary", "")[:300] if item.get("summary") else "",
                url=url,
                published_at=datetime.fromtimestamp(item.get("datetime", 0)).isoformat(),
                category=category,
                image_url=item.get("image") if item.get("image") else None,
            ))

        articles = _diversify_sources(candidates, limit)

        # Mark only selected articles as used (cross-category dedup)
        for a in articles:
            self._used_urls.add(a.url)

        self._category_cache[cache_key] = (articles, now)
        return articles

    def get_all_categories(self) -> list[str]:
        return ["top", "energy", "geopolitics", "stocks"]


class NewsAPIProvider(NewsProvider):
    """
    NewsAPI.org provider.
    Better categorization and more sources.
    """

    BASE_URL = "https://newsapi.org/v2"

    # Category search queries
    CATEGORY_QUERIES = {
        "top": "stock market OR wall street OR financial markets",
        "energy": "oil price OR energy sector OR OPEC OR natural gas",
        "geopolitics": "trade war OR sanctions OR tariffs OR geopolitical",
        "stocks": "earnings OR IPO OR nasdaq OR S&P 500 OR dow jones",
    }

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._cache: dict[str, tuple[list[NewsArticle], float]] = {}
        self._cache_ttl = 900  # 15 minutes

    def _get(self, endpoint: str, params: dict = None) -> Optional[dict]:
        params = params or {}
        headers = {"X-Api-Key": self.api_key}
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.BASE_URL}{endpoint}", params=params, headers=headers)
                if resp.status_code == 200:
                    return resp.json()
                return None
        except Exception:
            return None

    def get_news(self, category: str, limit: int = 10) -> list[NewsArticle]:
        cache_key = f"{category}:{limit}"
        now = time.time()

        if cache_key in self._cache:
            cached, cached_at = self._cache[cache_key]
            if now - cached_at < self._cache_ttl:
                return cached

        query = self.CATEGORY_QUERIES.get(category.lower(), self.CATEGORY_QUERIES["top"])
        fetch_size = min(limit * 6, 100)
        data = self._get("/everything", {
            "q": query,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": fetch_size,
        })

        if not data or "articles" not in data:
            return []

        candidates: list[NewsArticle] = []
        for item in data["articles"]:
            candidates.append(NewsArticle(
                title=item.get("title", "") or "",
                source=item.get("source", {}).get("name", "") or "",
                summary=(item.get("description", "") or "")[:300],
                url=item.get("url", "") or "",
                published_at=item.get("publishedAt", ""),
                category=category,
                image_url=item.get("urlToImage"),
            ))

        articles = _diversify_sources(candidates, limit)
        self._cache[cache_key] = (articles, now)
        return articles

    def get_all_categories(self) -> list[str]:
        return ["top", "energy", "geopolitics", "stocks"]


class StubNewsProvider(NewsProvider):
    """Stub provider for development/testing."""

    def get_news(self, category: str, limit: int = 10) -> list[NewsArticle]:
        return []

    def get_all_categories(self) -> list[str]:
        return ["top", "energy", "geopolitics", "stocks"]


# Singleton provider instance
_provider: Optional[NewsProvider] = None


def get_news_provider() -> NewsProvider:
    """Get the configured news provider."""
    global _provider
    if _provider is None:
        # Prefer NewsAPI, fall back to Finnhub, then stub
        newsapi_key = os.getenv("NEWSAPI_KEY")
        finnhub_key = os.getenv("FINNHUB_API_KEY")

        if newsapi_key:
            _provider = NewsAPIProvider(newsapi_key)
        elif finnhub_key:
            _provider = FinnhubNewsProvider(finnhub_key)
        else:
            _provider = StubNewsProvider()
    return _provider


def reset_news_provider():
    """Reset provider (useful for testing)."""
    global _provider
    _provider = None


# Convenience functions
def get_news(category: str, limit: int = 3) -> list[NewsArticle]:
    """Get news for a category."""
    return get_news_provider().get_news(category, limit)


def get_all_news(limit_per_category: int = 3) -> tuple[dict[str, list[NewsArticle]], float]:
    """Get news for all categories. Returns (articles_by_category, last_updated_timestamp)."""
    provider = get_news_provider()
    result = {}
    oldest_cache_time = time.time()

    # Reset used URLs for FinnhubNewsProvider to ensure proper deduplication
    if isinstance(provider, FinnhubNewsProvider):
        # Check if we need fresh data (cache expired)
        now = time.time()
        if provider._raw_cache:
            _, cached_at = provider._raw_cache
            if now - cached_at >= provider._cache_ttl:
                provider._used_urls = set()
        else:
            provider._used_urls = set()

    for category in provider.get_all_categories():
        result[category] = provider.get_news(category, limit_per_category)
        # Track the oldest cache time
        cache_key = f"{category}:{limit_per_category}"
        if hasattr(provider, '_category_cache') and cache_key in provider._category_cache:
            _, cached_at = provider._category_cache[cache_key]
            oldest_cache_time = min(oldest_cache_time, cached_at)
        elif hasattr(provider, '_cache') and cache_key in provider._cache:
            _, cached_at = provider._cache[cache_key]
            oldest_cache_time = min(oldest_cache_time, cached_at)

    return result, oldest_cache_time


def get_news_categories() -> list[str]:
    """Get list of supported categories."""
    return get_news_provider().get_all_categories()
