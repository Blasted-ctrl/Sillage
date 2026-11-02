import csv
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sklearn.metrics.pairwise import cosine_similarity

sys.path.insert(0, str(Path(__file__).parents[1]))
from api import app, get_engine
from recommender import Recommender, contains


@pytest.fixture(scope="module")
def catalogue_path(tmp_path_factory):
    path = tmp_path_factory.mktemp("catalogue") / "fragrances.csv"
    rows = [
        ("vanilla woods", "house a", "bergamot", "cedar", "vanilla, sandalwood", "woody, vanilla, amber", "men"),
        ("rose woods", "house b", "lemon", "rose", "cedar, vanilla", "rose, woody, floral", "women"),
        ("citrus water", "house c", "bergamot, lemon", "sea notes", "musk", "citrus, aquatic, fresh", "unisex"),
        ("vanilla twin", "house d", "bergamot", "cedar", "vanilla, sandalwood", "woody, vanilla, amber", "unisex"),
        ("green forest", "house e", "pine", "vetiver", "cedar", "woody, green", "men"),
        ("white rose", "house f", "lemon", "bulgarian rose", "musk", "floral, musky", "women"),
    ]
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["name", "brand", "notes_top", "notes_middle", "notes_base", "accords", "gender", "url"])
        for index, row in enumerate(rows):
            writer.writerow([*row, f"https://example.com/{index}"])
        writer.writerow([*rows[0], "https://example.com/duplicate"])
    return path


@pytest.fixture(scope="module")
def engine(catalogue_path):
    return Recommender(catalogue_path)


def test_cosine_matches_reference_and_is_deterministic(engine):
    results = engine.recommend("vanilla woody", diversity=0)["results"]
    features, _ = engine.parse_query("vanilla woody", [])
    profile = engine.tfidf.transform(engine.vectorizer.transform([features]))
    expected = cosine_similarity(engine.matrix, profile).ravel()
    for result in results:
        assert result["similarity"] == pytest.approx(expected[engine.by_id[result["id"]]], abs=1e-6)
        assert result["matched_notes"]
    assert results == engine.recommend("vanilla woody", diversity=0)["results"]
    assert np.allclose(np.asarray(engine.matrix.multiply(engine.matrix).sum(axis=1)), 1)


def test_exclusions_apply_to_compound_notes_before_limit(engine):
    result = engine.recommend("woody vanilla without rose", limit=4)
    assert result["excluded_notes"] == ["rose"]
    assert result["results"]
    for fragrance in result["results"]:
        assert not any(contains(note, "rose") for notes in fragrance["notes"].values() for note in notes)
    assert len(engine.recommend("musk", avoid_notes=["rose"])["results"]) == 1


def test_source_exclusion_uses_identity_not_perfect_similarity(engine):
    source = engine.records[0]["id"]
    result = engine.recommend(source_id=source, limit=3)
    assert source not in [item["id"] for item in result["results"]]
    assert result["results"][0]["name"] == "vanilla twin"
    assert result["results"][0]["similarity"] == pytest.approx(1)
    assert len(engine.records) == 6


def test_preferences_change_ranking_and_do_not_resurface_rated_bottles(engine):
    liked = engine.records[2]["id"]
    disliked = engine.records[0]["id"]
    baseline = engine.recommend("woody musk", diversity=0)["results"]
    adapted = engine.recommend("woody musk", liked_ids=[liked], disliked_ids=[disliked], diversity=0)["results"]
    assert liked not in [item["id"] for item in adapted]
    assert disliked not in [item["id"] for item in adapted]
    assert baseline != adapted
    assert engine.recommend(liked_ids=[liked])["results"]
    with pytest.raises(ValueError):
        engine.recommend("woody", liked_ids=[liked], disliked_ids=[liked])
    with pytest.raises(ValueError):
        engine.recommend("woody", liked_ids=["unknown"])


def test_filters_empty_query_and_unknown_words(engine):
    assert engine.recommend("xyzzy")["results"] == []
    assert engine.recommend("without vanilla")["results"] == []
    assert all(item["gender"] in ("men", "unisex") for item in engine.recommend("woody", gender="men")["results"])
    assert engine.recommend("wood")["recognized_notes"] == ["woody"]
    assert "citrus" in engine.recommend("summer")["recognized_notes"]


def test_learned_weights_load_only_for_matching_features(engine, catalogue_path, tmp_path):
    weights = np.linspace(0.5, 2, engine.matrix.shape[1])
    path = tmp_path / "weights.json"
    artifact = {"version": 1, "feature_signature": engine.feature_signature, "weights": weights.tolist()}
    path.write_text(json.dumps(artifact), encoding="utf-8")
    learned = Recommender(catalogue_path, weights_path=path)
    assert learned.learned_weights
    features, _ = learned.parse_query("woody vanilla", [])
    vector = learned.tfidf.transform(learned.vectorizer.transform([features])).multiply(np.sqrt(weights))
    expected = cosine_similarity(learned.matrix, vector).ravel()
    for result in learned.recommend("woody vanilla", diversity=0)["results"]:
        assert result["similarity"] == pytest.approx(expected[learned.by_id[result["id"]]], abs=1e-6)
    artifact["feature_signature"] = "wrong-catalogue"
    path.write_text(json.dumps(artifact), encoding="utf-8")
    with pytest.raises(ValueError):
        Recommender(catalogue_path, weights_path=path)


def test_diversity_and_name_lookup(engine):
    similar = engine.recommend("woody vanilla", limit=3, diversity=0)["results"]
    diverse = engine.recommend("woody vanilla", limit=3, diversity=0.4)["results"]
    assert similar[0]["id"] == diverse[0]["id"]
    assert len({item["id"] for item in diverse}) == len(diverse)
    assert engine.resolve_name("house a vanilla woods") == 0
    assert engine.resolve_name("house a vanila woods") == 0
    assert engine.suggest("citrus")[0]["name"] == "citrus water"
    with pytest.raises(ValueError):
        engine.resolve_name("this fragrance does not exist xyzzy")


def test_api_validation_and_original_endpoint_contracts(engine):
    app.dependency_overrides[get_engine] = lambda: engine
    try:
        client = TestClient(app)
        assert client.get("/").json()["catalogue_size"] == 6
        assert client.post("/search", json={"query": "woody"}).json()["results"]
        for payload in ({"query": " "}, {"query": "123"}, {"query": "woody", "limit": 1000},
                        {"query": "woody", "diversity": -1}, {"query": "woody", "gender": "invalid"},
                        {"query": "woody", "liked_ids": ["bad"]}):
            assert client.post("/search", json=payload).status_code == 422
        similar = client.post("/similar", json={"cologne_name": "house a vanilla woods"})
        assert similar.status_code == 200
        assert isinstance(similar.json()["matched"], str)
        assert similar.json()["source"]["name"] == "vanilla woods"
        assert client.get("/catalogue", params={"q": "citrus"}).json()["results"]
        assert client.get("/catalogue", params={"q": "x"}).status_code == 422
        assert client.post("/similar", json={"cologne_name": "nonexistent xyzzy"}).status_code == 404
    finally:
        app.dependency_overrides.clear()
