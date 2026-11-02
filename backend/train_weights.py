"""Learn diagonal cosine weights from explicit, consented fragrance preferences.

Input JSONL: user_id, query, positive_id, negative_id. No synthetic labels.
Users, rather than individual rows, are held out to avoid preference leakage.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.special import expit
from sklearn.model_selection import GroupShuffleSplit

from recommender import Recommender


def cosine_and_gradient(query, candidate, weights):
    query_norm = np.dot(weights, query * query)
    candidate_norm = np.dot(weights, candidate * candidate)
    denominator = np.sqrt(query_norm * candidate_norm)
    if denominator <= 1e-12:
        raise ValueError("Every training query and candidate must have scent features")
    similarity = np.dot(weights, query * candidate) / denominator
    gradient = query * candidate / denominator - similarity * 0.5 * (
        query * query / query_norm + candidate * candidate / candidate_norm)
    return similarity, gradient


def metrics(examples, weights):
    margins = np.array([cosine_and_gradient(q, pos, weights)[0] - cosine_and_gradient(q, neg, weights)[0]
                        for q, pos, neg in examples])
    return {"pairs": len(examples), "pairwise_accuracy": float(np.mean(margins > 0)),
            "log_loss": float(np.logaddexp(0, -margins / 0.1).mean())}


def train(examples, dimensions, epochs=30, learning_rate=0.02):
    log_weights = np.zeros(dimensions)
    random = np.random.default_rng(42)
    for _ in range(epochs):
        for index in random.permutation(len(examples)):
            query, positive, negative = examples[index]
            weights = np.exp(log_weights)
            positive_score, positive_gradient = cosine_and_gradient(query, positive, weights)
            negative_score, negative_gradient = cosine_and_gradient(query, negative, weights)
            gradient = -expit(-(positive_score - negative_score) / 0.1) / 0.1 * (positive_gradient - negative_gradient)
            log_weights -= learning_rate * (gradient * weights + 0.01 * log_weights)
            log_weights = np.clip(log_weights, np.log(0.25), np.log(4))
    return np.exp(log_weights)


def load_examples(path, engine):
    examples, groups = [], []
    with Path(path).open(encoding="utf-8") as file:
        for line_number, line in enumerate(file, 1):
            if not line.strip():
                continue
            row = json.loads(line)
            user = row.get("user_id", "")
            if not isinstance(user, str) or not user.strip():
                raise ValueError(f"Line {line_number} needs a pseudonymous user_id")
            features, avoided = engine.parse_query(row["query"], [])
            if not features or avoided:
                raise ValueError(f"Line {line_number}: use a recognized positive scent query; exclusions are enforced separately")
            indices = engine._indices([row["positive_id"], row["negative_id"]])
            if len(indices) != 2:
                raise ValueError(f"Line {line_number}: positive and negative fragrances must differ")
            query = engine.tfidf.transform(engine.vectorizer.transform([features])).toarray().ravel()
            examples.append((query, engine.matrix[indices[0]].toarray().ravel(), engine.matrix[indices[1]].toarray().ravel()))
            groups.append(user)
    if len(examples) < 20 or len(set(groups)) < 5:
        raise ValueError("Provide at least 20 explicit preference pairs from at least 5 consenting users. More data is needed for credible evaluation.")
    return examples, groups


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("feedback", type=Path)
    parser.add_argument("--output", type=Path, default=Path("scent-weights.json"))
    args = parser.parse_args()
    engine = Recommender()
    examples, groups = load_examples(args.feedback, engine)
    train_indices, validation_indices = next(GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42).split(examples, groups=groups))
    training = [examples[index] for index in train_indices]
    validation = [examples[index] for index in validation_indices]
    weights = train(training, engine.matrix.shape[1])
    baseline = metrics(validation, np.ones(engine.matrix.shape[1]))
    learned = metrics(validation, weights)
    report = {"train_pairs": len(training), "held_out_users": len(set(groups[index] for index in validation_indices)),
              "baseline_validation": baseline, "learned_validation": learned}
    print(json.dumps(report, indent=2))
    if learned["pairwise_accuracy"] < baseline["pairwise_accuracy"] or learned["log_loss"] >= baseline["log_loss"]:
        raise SystemExit("No held-out improvement. Keeping the cosine baseline; no model written.")
    artifact = {"version": 1, "feature_signature": engine.feature_signature,
                "weights": weights.tolist(), "evaluation": report}
    args.output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    print(f"Candidate weights written to {args.output}. Review an independent test set before production use.")


if __name__ == "__main__":
    main()
