"""Local, explainable fragrance retrieval using weighted TF–IDF cosine similarity."""

import csv
import hashlib
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix, diags
from sklearn.feature_extraction import DictVectorizer
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.preprocessing import normalize

DATA_PATH = Path(__file__).parent / "data" / "fragrances_clean.csv"
ALIASES = {"woods": "woody", "wood": "woody", "woodsy": "woody", "vetyver": "vetiver",
           "oudh": "oud", "agarwood (oud)": "oud", "citruses": "citrus"}
MOODS = {
    "warm": ["amber", "warm spicy"], "cozy": ["vanilla", "amber", "woody"],
    "clean": ["fresh", "musky"], "crisp": ["citrus", "fresh"],
    "summer": ["citrus", "fresh", "aquatic"], "winter": ["amber", "woody", "warm spicy"],
    "office": ["fresh", "woody"], "date night": ["amber", "vanilla", "woody"],
    "beach": ["aquatic", "citrus"], "smoky": ["smoky", "incense"],
    "spicy": ["warm spicy", "fresh spicy"],
}
NEGATION = re.compile(r"\b(?:without|avoid(?:ing)?|no|not(?: too)?|exclude)\s+(.+?)(?=[,.;]|\bbut\b|\bwith\b|$)", re.I)


def canonical(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"\s+", " ", text.replace("-", " ")).strip()
    return ALIASES.get(text, text)


def split_notes(text):
    return list(dict.fromkeys(canonical(part) for part in (text or "").split(",") if part.strip()))


def contains(text, term):
    return bool(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text))


def scent_features(notes, accords):
    features = {}
    for layer, weight in (("top", 1.0), ("middle", 1.25), ("base", 1.5)):
        for note in notes[layer]:
            features[note] = features.get(note, 0) + weight
    for position, accord in enumerate(accords):
        features[accord] = features.get(accord, 0) + 2 / (1 + position * 0.2)
    return features


class Recommender:
    def __init__(self, path=DATA_PATH, weights_path=None):
        self.records = []
        seen = set()
        with Path(path).open(encoding="utf-8-sig", newline="") as file:
            for row in csv.DictReader(file):
                identity = (canonical(row["brand"]), canonical(row["name"]))
                notes = {layer: split_notes(row.get(f"notes_{layer}")) for layer in ("top", "middle", "base")}
                if identity in seen or not all(identity) or not any(notes.values()):
                    continue
                seen.add(identity)
                url = row.get("url", "")
                self.records.append({
                    "id": hashlib.sha256((url or "|".join(identity)).encode()).hexdigest()[:16],
                    "name": row["name"].replace("-", " "), "brand": row["brand"].replace("-", " "),
                    "gender": row.get("gender", "unisex"), "url": url,
                    "notes": notes, "accords": split_notes(row.get("accords")),
                })
        if not self.records:
            raise ValueError("The fragrance catalogue has no usable records")
        self.by_id = {record["id"]: index for index, record in enumerate(self.records)}
        self.features = [scent_features(record["notes"], record["accords"]) for record in self.records]
        self.vectorizer = DictVectorizer(dtype=np.float64)
        self.tfidf = TfidfTransformer(norm="l2", sublinear_tf=True)
        self.matrix = self.tfidf.fit_transform(self.vectorizer.fit_transform(self.features)).tocsr()
        signature = json.dumps([self.vectorizer.feature_names_, self.tfidf.idf_.tolist()])
        self.feature_signature = hashlib.sha256(signature.encode()).hexdigest()
        self.scales = np.ones(self.matrix.shape[1])
        self.learned_weights = bool(weights_path)
        if weights_path:
            artifact = json.loads(Path(weights_path).read_text(encoding="utf-8"))
            weights = np.asarray(artifact["weights"], dtype=float)
            if (artifact.get("version") != 1 or artifact.get("feature_signature") != self.feature_signature
                    or weights.shape != self.scales.shape or not np.isfinite(weights).all()
                    or not ((weights >= 0.25) & (weights <= 4)).all()):
                raise ValueError("Scent weights are invalid or do not match this catalogue. Retrain before loading them.")
            self.scales = np.sqrt(weights)
            self.matrix = normalize(self.matrix @ diags(self.scales)).tocsr()
        self.vocabulary = set(self.vectorizer.feature_names_)
        self.term_patterns = {
            term: re.compile(r"(?<!\w)" + re.escape(term) + r"(?!\w)")
            for term in self.vocabulary | ALIASES.keys()
        }
        self.names = [canonical(f"{r['brand']} {r['name']}") for r in self.records]

    def query_terms(self, text):
        text = canonical(text)
        return {ALIASES.get(term, term) for term, pattern in self.term_patterns.items()
                if pattern.search(text)} & self.vocabulary

    def parse_query(self, query, avoid_notes):
        negative = set()
        for match in NEGATION.finditer(query):
            negative.update(self.query_terms(match.group(1)))
        positive = canonical(NEGATION.sub(" ", query))
        negative.update(canonical(note) for note in avoid_notes)
        features = {term: 2.0 for term in self.query_terms(positive)}
        for mood, expansion in MOODS.items():
            if contains(positive, mood):
                for term in expansion:
                    if term in self.vocabulary and term not in negative:
                        features[term] = max(features.get(term, 0), 0.7)
        for term in negative:
            features.pop(term, None)
        return features, negative

    def suggest(self, query, limit=8):
        words = canonical(query).split()
        if not words:
            return []
        matches = [(index, name) for index, name in enumerate(self.names) if all(word in name for word in words)]
        matches.sort(key=lambda item: (len(item[1]), item[1]))
        return [self.records[index] for index, _ in matches[:limit]]

    def resolve_name(self, query):
        query = canonical(query)
        if len(query) < 3:
            raise ValueError("Enter at least three characters of a fragrance name")
        exact = [i for i, name in enumerate(self.names) if name == query or canonical(self.records[i]["name"]) == query]
        if exact:
            return exact[0]
        suggestions = self.suggest(query)
        if suggestions:
            return self.by_id[suggestions[0]["id"]]
        scored = [(SequenceMatcher(None, query, name).ratio(), index) for index, name in enumerate(self.names)]
        score, index = max(scored)
        if score < 0.72:
            raise ValueError("No close fragrance name found. Try the brand and fragrance name.")
        return index

    def _indices(self, ids):
        if set(ids) - self.by_id.keys():
            raise ValueError("A saved fragrance is no longer in the catalogue. Remove it and try again.")
        return [self.by_id[key] for key in dict.fromkeys(ids)]

    def recommend(self, query="", *, limit=9, avoid_notes=(), liked_ids=(), disliked_ids=(),
                  gender="all", diversity=0.15, source_id=None):
        liked = self._indices(liked_ids)
        disliked = self._indices(disliked_ids)
        if set(liked) & set(disliked):
            raise ValueError("A fragrance cannot be both liked and disliked")
        features, avoided = self.parse_query(query, avoid_notes)
        profile = normalize(self.tfidf.transform(self.vectorizer.transform([features])).multiply(self.scales)).tocsr()
        source = self._indices([source_id])[0] if source_id else None
        if source is not None:
            profile = profile + self.matrix[source]
        if liked:
            profile = profile + csr_matrix(self.matrix[liked].mean(axis=0)) * 0.65
        if disliked and profile.nnz:
            profile = profile - csr_matrix(self.matrix[disliked].mean(axis=0)) * 0.35
        if not profile.nnz or not (profile.data > 0).any():
            return {"results": [], "recognized_notes": [], "excluded_notes": sorted(avoided),
                    "message": "Try notes such as bergamot, vanilla, woody or musk, or choose a fragrance you love."}
        profile = normalize(profile, norm="l2")
        # Unit-length sparse vectors: their dot product is cosine similarity.
        similarities = (self.matrix @ profile.T).toarray().ravel()
        excluded = set(liked + disliked + ([source] if source is not None else []))
        eligible = []
        for index in np.argsort(-similarities, kind="stable"):
            index = int(index)
            if similarities[index] <= 0.01:
                break
            record = self.records[index]
            if index in excluded or (gender != "all" and record["gender"] not in (gender, "unisex")):
                continue
            if any(any(contains(term, avoid) for term in self.features[index]) for avoid in avoided):
                continue
            eligible.append(index)
            if len(eligible) >= max(200, limit * 10):
                break
        selected = []
        pool = eligible.copy()
        redundancy = np.zeros(len(self.records))
        while pool and len(selected) < limit:
            # MMR makes room for distinct profiles without replacing cosine relevance.
            best = max(pool, key=lambda i: (1 - diversity) * similarities[i] - diversity * redundancy[i])
            selected.append(best)
            pool.remove(best)
            if pool and diversity:
                overlap = (self.matrix[pool] @ self.matrix[best].T).toarray().ravel()
                redundancy[pool] = np.maximum(redundancy[pool], overlap)
        results = []
        for index in selected:
            contributions = self.matrix[index].multiply(profile).tocoo()
            shared = sorted(zip(contributions.col, contributions.data), key=lambda item: -item[1])
            reasons = [self.vectorizer.feature_names_[column] for column, value in shared if value > 0][:4]
            results.append({**self.records[index], "similarity": round(float(similarities[index]), 6),
                            "matched_notes": reasons,
                            "sample_advice": "Sample on skin first. Notes alone cannot predict how this will wear on you."})
        return {"results": results, "recognized_notes": sorted(features), "excluded_notes": sorted(avoided),
                "message": None if results else "No matches with these exclusions. Try fewer notes to avoid.",
                "matched": self.records[source] if source is not None else None}
