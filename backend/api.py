"""Sillage API. Runs against the checked-in catalogue without external services."""
import os
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StringConstraints, model_validator
from recommender import Recommender


@lru_cache(maxsize=1)
def get_engine():
    return Recommender(weights_path=os.getenv("SCENT_WEIGHTS_PATH"))


@asynccontextmanager
async def lifespan(app):
    get_engine()
    yield


app = FastAPI(title="Sillage", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
)
FragranceId = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{16}$")]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class Preferences(BaseModel):
    limit: int = Field(default=9, ge=1, le=24)
    avoid_notes: list[Note] = Field(default_factory=list, max_length=30)
    liked_ids: list[FragranceId] = Field(default_factory=list, max_length=50)
    disliked_ids: list[FragranceId] = Field(default_factory=list, max_length=50)
    gender: Literal["all", "men", "women", "unisex"] = "all"
    diversity: float = Field(default=0.15, ge=0, le=0.4, allow_inf_nan=False)


class SearchRequest(Preferences):
    query: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def require_intent(self):
        self.query = self.query.strip()
        if not self.query and not self.liked_ids:
            raise ValueError("Describe a scent or choose a fragrance you like")
        if self.query and not any(character.isalpha() for character in self.query):
            raise ValueError("Please describe a scent using words")
        return self


class SimilarRequest(Preferences):
    cologne_name: str = Field(default="", max_length=200)
    cologne_id: FragranceId | None = None

    @model_validator(mode="after")
    def require_source(self):
        if not self.cologne_id and len(self.cologne_name.strip()) < 3:
            raise ValueError("Choose a fragrance or enter at least three characters")
        return self


Engine = Annotated[Recommender, Depends(get_engine)]


@app.get("/")
def root(engine: Engine):
    return {"status": "ok", "catalogue_size": len(engine.records), "method": "weighted-tfidf-cosine", "learned_weights": engine.learned_weights}


@app.get("/catalogue")
def catalogue(engine: Engine, q: str = Query(min_length=2, max_length=100), limit: int = Query(default=8, ge=1, le=20)):
    return {"results": engine.suggest(q, limit)}


@app.post("/search")
def search(req: SearchRequest, engine: Engine):
    try:
        return engine.recommend(**req.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/similar")
def similar(req: SimilarRequest, engine: Engine):
    try:
        source_id = req.cologne_id
        if not source_id:
            source_id = engine.records[engine.resolve_name(req.cologne_name)]["id"]
        result = engine.recommend(source_id=source_id, **req.model_dump(exclude={"cologne_name", "cologne_id"}))
        source = result.pop("matched")
        return {**result, "matched": f"{source['brand']} {source['name']}", "source": source}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
