from typing import Optional
from pydantic import BaseModel


class NewsArticleResponse(BaseModel):
    title: str
    source: str
    summary: str
    url: str
    published_at: str
    category: str
    image_url: Optional[str] = None


class NewsCategoryResponse(BaseModel):
    category: str
    display_name: str
    articles: list[NewsArticleResponse]


class NewsResponse(BaseModel):
    categories: list[NewsCategoryResponse]
    last_updated: str
