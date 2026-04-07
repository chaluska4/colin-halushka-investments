from datetime import datetime
from typing import Annotated, List

from fastapi import APIRouter, Depends

from ..dependencies.auth import get_current_user
from ..models import User
from ..schemas.news import NewsArticleResponse, NewsCategoryResponse, NewsResponse
from ..services.news import get_news, get_all_news, get_news_categories


news_router = APIRouter(prefix="/news", tags=["news"])

CATEGORY_DISPLAY_NAMES = {
    "top": "Top Market Headlines",
    "energy": "Energy & Oil",
    "geopolitics": "Geopolitics",
    "stocks": "Stocks & Companies",
}


@news_router.get("", response_model=NewsResponse)
def get_market_news(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Get market news across all categories.
    Returns news grouped by category with 15-minute caching.
    """
    all_news, last_updated_ts = get_all_news(limit_per_category=3)

    categories = []
    for category in get_news_categories():
        articles = all_news.get(category, [])
        categories.append(NewsCategoryResponse(
            category=category,
            display_name=CATEGORY_DISPLAY_NAMES.get(category, category.title()),
            articles=[
                NewsArticleResponse(
                    title=a.title,
                    source=a.source,
                    summary=a.summary,
                    url=a.url,
                    published_at=a.published_at,
                    category=a.category,
                    image_url=a.image_url,
                )
                for a in articles
            ],
        ))

    last_updated = datetime.fromtimestamp(last_updated_ts).isoformat()
    return NewsResponse(categories=categories, last_updated=last_updated)


@news_router.get("/{category}", response_model=List[NewsArticleResponse])
def get_news_by_category(
    category: str,
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = 10,
):
    """
    Get news for a specific category.

    Categories: top, energy, geopolitics, stocks
    """
    articles = get_news(category, limit=limit)
    return [
        NewsArticleResponse(
            title=a.title,
            source=a.source,
            summary=a.summary,
            url=a.url,
            published_at=a.published_at,
            category=a.category,
            image_url=a.image_url,
        )
        for a in articles
    ]
