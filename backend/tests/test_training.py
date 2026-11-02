import numpy as np
import pytest

from train_weights import cosine_and_gradient, metrics, train


def test_cosine_gradient_matches_finite_difference():
    query = np.array([0.8, 0.3, 0.5])
    candidate = np.array([0.2, 0.7, 0.6])
    weights = np.array([1.2, 0.8, 1.5])
    _, gradient = cosine_and_gradient(query, candidate, weights)
    for column in range(3):
        plus, minus = weights.copy(), weights.copy()
        plus[column] += 1e-6
        minus[column] -= 1e-6
        numeric = (cosine_and_gradient(query, candidate, plus)[0] - cosine_and_gradient(query, candidate, minus)[0]) / 2e-6
        assert gradient[column] == pytest.approx(numeric, abs=1e-7)


def test_training_is_deterministic_bounded_and_improves_training_loss():
    examples = [(np.array([1., 1., 0.]), np.array([1., 0., 0.]), np.array([0., 1., 1.]))]
    weights = train(examples, 3)
    assert weights == pytest.approx(train(examples, 3))
    assert np.all((weights >= 0.25) & (weights <= 4))
    assert metrics(examples, weights)["log_loss"] < metrics(examples, np.ones(3))["log_loss"]
    with pytest.raises(ValueError):
        cosine_and_gradient(np.zeros(3), np.ones(3), weights)
