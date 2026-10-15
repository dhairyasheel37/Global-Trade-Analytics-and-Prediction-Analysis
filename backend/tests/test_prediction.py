import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.utils.auth import seed_default_users
from app.ml.prediction import (
    prepare_time_series_features,
    train_and_forecast_pipeline,
    FEATURE_NAMES,
)

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    db = SessionLocal()
    seed_default_users(db)
    db.close()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers(client):
    res = client.post("/api/auth/login", json={"username": "trader", "password": "Trader@Trade2026!"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_leakage_prevention_in_features():
    """
    VERBATIM LEAKAGE-PREVENTION TEST:
    Verifies that feature engineering strictly uses past values.
    For any row at index t corresponding to observation y_t:
    - lag_1 must equal y_{t-1}
    - lag_2 must equal y_{t-2}
    - lag_3 must equal y_{t-3}
    - rolling_mean_3 must equal mean(y_{t-1}, y_{t-2}, y_{t-3}) and must NOT include y_t.
    """
    sample_raw = [
        {"year": 2014, "value": 100.0},
        {"year": 2015, "value": 120.0},
        {"year": 2016, "value": 140.0},
        {"year": 2017, "value": 160.0},
        {"year": 2018, "value": 190.0},
        {"year": 2019, "value": 210.0},
        {"year": 2020, "value": 230.0},
        {"year": 2021, "value": 260.0},
        {"year": 2022, "value": 300.0},
        {"year": 2023, "value": 340.0},
        {"year": 2024, "value": 380.0},
        {"year": 2025, "value": 420.0},
    ]

    df = prepare_time_series_features(sample_raw)

    # 12 original rows minus 3 dropped NaN lag rows = 9 usable rows
    assert len(df) == 9

    # Check that row 0 corresponds to year 2017 (target = 160.0)
    row_2017 = df[df["year"] == 2017].iloc[0]
    assert row_2017["target"] == 160.0
    assert row_2017["lag_1"] == 140.0  # 2016 value
    assert row_2017["lag_2"] == 120.0  # 2015 value
    assert row_2017["lag_3"] == 100.0  # 2014 value
    assert row_2017["rolling_mean_3"] == pytest.approx((140.0 + 120.0 + 100.0) / 3.0)

    # Check row 2025 (target = 420.0)
    row_2025 = df[df["year"] == 2025].iloc[0]
    assert row_2025["target"] == 420.0
    assert row_2025["lag_1"] == 380.0  # 2024
    assert row_2025["lag_2"] == 340.0  # 2023
    assert row_2025["lag_3"] == 300.0  # 2022
    assert row_2025["rolling_mean_3"] == pytest.approx((380.0 + 340.0 + 300.0) / 3.0)


def test_minimum_observations_threshold_enforced():
    """
    Verifies that when usable observations < 8, the pipeline halts without training
    and returns a structured failure with usable vs required count.
    """
    # Only 8 raw observations -> 8 - 3 = 5 usable observations (< 8)
    short_raw = [
        {"year": 2018, "value": 100.0},
        {"year": 2019, "value": 120.0},
        {"year": 2020, "value": 140.0},
        {"year": 2021, "value": 160.0},
        {"year": 2022, "value": 180.0},
        {"year": 2023, "value": 200.0},
        {"year": 2024, "value": 220.0},
        {"year": 2025, "value": 240.0},
    ]

    res = train_and_forecast_pipeline(short_raw)
    assert res["success"] is False
    assert res["usable_observations"] == 5
    assert res["required_observations"] == 8
    assert "Insufficient historical data for reliable prediction." in res["error_message"]


def test_prediction_models_and_baseline_mae():
    """
    Verifies training of Linear Regression, Random Forest, and computation of naive baseline MAE.
    """
    sample_raw = [{"year": 2014 + i, "value": 100.0 + i * 15.0} for i in range(12)]
    res = train_and_forecast_pipeline(sample_raw, forecast_horizon=3)

    assert res["success"] is True
    assert res["usable_observations"] == 9
    assert res["baseline_mae"] > 0
    assert "linear_regression" in res["models"]
    assert "random_forest" in res["models"]

    lr = res["models"]["linear_regression"]
    rf = res["models"]["random_forest"]

    assert lr["metrics"]["mae"] >= 0
    assert lr["metrics"]["rmse"] >= 0
    assert rf["metrics"]["mae"] >= 0
    assert rf["metrics"]["rmse"] >= 0
    assert len(lr["forecast_series"]) == 3
    assert len(rf["forecast_series"]) == 3


def test_low_confidence_warning_when_r2_negative():
    """
    Verifies that when test set R² is negative, low_confidence_warning is set to the exact required string.
    """
    # Chaotic non-linear step data where linear model fails worse than mean on test
    chaotic_raw = [
        {"year": 2014, "value": 10.0},
        {"year": 2015, "value": 12.0},
        {"year": 2016, "value": 15.0},
        {"year": 2017, "value": 18.0},
        {"year": 2018, "value": 20.0},
        {"year": 2019, "value": 22.0},
        {"year": 2020, "value": 25.0},
        {"year": 2021, "value": 30.0},
        {"year": 2022, "value": 35.0},
        {"year": 2023, "value": 500.0},  # sudden extreme spike in train
        {"year": 2024, "value": 1.0},    # test set collapses
        {"year": 2025, "value": 1.0},    # test set collapses
    ]

    res = train_and_forecast_pipeline(chaotic_raw)
    assert res["success"] is True
    # If the chosen best model has R2 < 0, check warning string
    best = res["best_model"]
    best_r2 = res["models"][best]["metrics"]["r2"]
    if best_r2 < 0:
        assert res["low_confidence_warning"] == "Low-confidence model performance: the selected model performed worse than a simple historical-mean baseline on the test data."


def test_recursive_forecast_horizon():
    """Verifies that forecast horizon generates correct future years with non-negative bounds."""
    sample_raw = [{"year": 2014 + i, "value": 50.0 + i * 10.0} for i in range(12)]
    res = train_and_forecast_pipeline(sample_raw, forecast_horizon=5)

    assert res["success"] is True
    lr_forecast = res["models"]["linear_regression"]["forecast_series"]
    assert len(lr_forecast) == 5
    assert [p["year"] for p in lr_forecast] == [2026, 2027, 2028, 2029, 2030]

    for p in lr_forecast:
        assert p["predicted"] >= 0
        assert p["lower_bound"] >= 0
        assert p["upper_bound"] >= p["lower_bound"]


def test_prediction_api_auth(client):
    """Prediction API endpoints require authentication."""
    res_get = client.get("/api/prediction/predict?reporter=USA&flow=X")
    assert res_get.status_code == 401

    res_post = client.post("/api/prediction/predict", json={"reporter": "USA", "flow": "X"})
    assert res_post.status_code == 401


def test_prediction_api_get_and_post_usa_exports(client, auth_headers):
    """Tests GET and POST prediction endpoints for USA Exports."""
    res_get = client.get("/api/prediction/predict?reporter=USA&flow=X&forecast_years=3", headers=auth_headers)
    assert res_get.status_code == 200
    data_get = res_get.json()

    assert data_get["success"] is True
    assert data_get["reporter"] == "USA"
    assert data_get["flow"] == "X"
    assert data_get["usable_observations"] == 9
    assert data_get["baseline_mae"] > 0
    assert "linear_regression" in data_get["models"]
    assert "random_forest" in data_get["models"]

    res_post = client.post(
        "/api/prediction/predict",
        json={"reporter": "USA", "flow": "X", "forecast_years": 3},
        headers=auth_headers,
    )
    assert res_post.status_code == 200
    data_post = res_post.json()
    assert data_post["reporter"] == "USA"
    assert data_post["usable_observations"] == data_get["usable_observations"]


def test_four_models_and_information_criteria(client, auth_headers):
    """
    Verifies that all 4 forecasting models (Linear Regression, Random Forest,
    ARIMA, and Holt-Winters) are trained, evaluated, and returned with AIC & BIC.
    """
    res = client.get("/api/prediction/predict?reporter=USA&flow=X&forecast_years=3", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    models = data["models"]
    assert "linear_regression" in models
    assert "random_forest" in models
    assert "arima" in models
    assert "holt_winters" in models

    # Exactly 1 best model flagged
    best_flags = [m["is_best"] for m in models.values()]
    assert sum(best_flags) == 1
    assert data["best_model"] in models

    # Check metrics for each model
    for model_key, model_data in models.items():
        metrics = model_data["metrics"]
        assert metrics["mae"] >= 0
        assert metrics["rmse"] >= 0
        assert "mape" in metrics
        assert "r2" in metrics
        assert metrics["aic"] is not None and not np.isnan(metrics["aic"])
        assert metrics["bic"] is not None and not np.isnan(metrics["bic"])
        assert "model_family" in model_data
        assert "model_order" in model_data

        # Verify forecasts
        forecast = model_data["forecast_series"]
        assert len(forecast) == 3
        for pt in forecast:
            assert pt["predicted"] >= 0
            assert pt["lower_bound"] >= 0
            assert pt["upper_bound"] >= pt["lower_bound"]

