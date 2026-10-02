import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

FEATURE_NAMES = ["lag_1", "lag_2", "lag_3", "rolling_mean_3", "pct_change_1", "year_trend"]

def prepare_time_series_features(raw_data: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Transforms raw annual observations into a strictly leakage-free feature DataFrame.
    
    Features strictly use past observations:
    - lag_1: y(t-1)
    - lag_2: y(t-2)
    - lag_3: y(t-3)
    - rolling_mean_3: (lag_1 + lag_2 + lag_3) / 3 (shifted by 1 relative to target)
    - pct_change_1: (lag_1 - lag_2) / lag_2 (shifted)
    - year_trend: year - min_year
    - target: y(t)
    """
    if not raw_data:
        return pd.DataFrame()

    df = pd.DataFrame(raw_data)
    if "year" not in df.columns or "value" not in df.columns:
        return pd.DataFrame()

    df = df.sort_values(by="year").reset_index(drop=True)
    df["value"] = pd.to_numeric(df["value"], errors="coerce").fillna(0.0)

    min_year = df["year"].min()

    # Create lag features (strictly prior to target)
    df["lag_1"] = df["value"].shift(1)
    df["lag_2"] = df["value"].shift(2)
    df["lag_3"] = df["value"].shift(3)
    df["rolling_mean_3"] = (df["lag_1"] + df["lag_2"] + df["lag_3"]) / 3.0

    # Safe percentage change without division by zero
    diff = df["lag_1"] - df["lag_2"]
    base = df["lag_2"].replace(0.0, np.nan)
    df["pct_change_1"] = (diff / base).fillna(0.0)

    df["year_trend"] = df["year"] - min_year
    df["target"] = df["value"]

    # Drop rows with NaN in lag features (first 3 rows)
    clean_df = df.dropna(subset=["lag_1", "lag_2", "lag_3", "rolling_mean_3"]).reset_index(drop=True)
    return clean_df


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Computes standard evaluation metrics: MAE, RMSE, R2, and MAPE."""
    mae = float(mean_absolute_error(y_true, y_pred))
    try:
        rmse = float(root_mean_squared_error(y_true, y_pred))
    except (AttributeError, TypeError):
        rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    
    # R2 Score (can be negative on small test sets)
    r2 = float(r2_score(y_true, y_pred)) if len(y_true) > 1 else 0.0

    # Safe MAPE
    denom = np.where(np.abs(y_true) > 1e-5, np.abs(y_true), 1e-5)
    mape = float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)

    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "mape": round(mape, 2),
    }


def recursive_forecast(
    model,
    feature_names: List[str],
    history_years: List[int],
    history_values: List[float],
    min_year: int,
    forecast_horizon: int,
    residual_std: float,
) -> List[Dict[str, Any]]:
    """
    Generates multi-step future projections recursively with 95% confidence intervals.
    """
    forecast_points = []
    
    # Initialize past sequence for recursive lag generation
    sim_years = list(history_years)
    sim_values = list(history_values)

    for h in range(1, forecast_horizon + 1):
        target_year = sim_years[-1] + 1
        
        lag_1 = sim_values[-1]
        lag_2 = sim_values[-2]
        lag_3 = sim_values[-3]
        rolling_mean_3 = (lag_1 + lag_2 + lag_3) / 3.0
        pct_change_1 = ((lag_1 - lag_2) / lag_2) if lag_2 != 0 else 0.0
        year_trend = target_year - min_year

        x_step = pd.DataFrame([{
            "lag_1": lag_1,
            "lag_2": lag_2,
            "lag_3": lag_3,
            "rolling_mean_3": rolling_mean_3,
            "pct_change_1": pct_change_1,
            "year_trend": year_trend,
        }])[feature_names]

        pred_raw = float(model.predict(x_step)[0])
        # Non-negative floor for monetary volume
        pred_val = max(0.0, pred_raw)

        # 95% confidence bounds scaling with forecast horizon sqrt(h)
        margin = 1.96 * residual_std * np.sqrt(h)
        lower_bound = max(0.0, pred_val - margin)
        upper_bound = pred_val + margin

        # Growth percentage relative to previous step
        prev_val = sim_values[-1]
        growth_pct = round(((pred_val - prev_val) / prev_val) * 100.0, 2) if prev_val > 0 else None

        forecast_points.append({
            "year": int(target_year),
            "predicted": round(pred_val, 2),
            "lower_bound": round(lower_bound, 2),
            "upper_bound": round(upper_bound, 2),
            "growth_pct": growth_pct,
        })

        # Append predicted value to simulation state for subsequent lag steps
        sim_years.append(target_year)
        sim_values.append(pred_val)

    return forecast_points


def train_and_forecast_pipeline(
    raw_data: List[Dict[str, Any]],
    forecast_horizon: int = 3,
) -> Dict[str, Any]:
    """
    Complete ML training, chronological evaluation, baseline benchmarking, and future forecasting.
    """
    # 1. Feature Engineering
    df = prepare_time_series_features(raw_data)
    usable_count = len(df)

    if usable_count < 8:
        return {
            "success": False,
            "error_message": "Insufficient historical data for reliable prediction.",
            "usable_observations": usable_count,
            "required_observations": 8,
        }

    min_year = int(pd.DataFrame(raw_data)["year"].min())
    all_years = df["year"].tolist()
    all_values = df["target"].tolist()

    # 2. Chronological Split (Testing on the last 2-3 observed years)
    test_size = max(2, min(3, int(usable_count * 0.25)))
    train_df = df.iloc[:-test_size].copy()
    test_df = df.iloc[-test_size:].copy()

    training_years = [int(y) for y in train_df["year"].tolist()]
    test_years = [int(y) for y in test_df["year"].tolist()]

    X_train = train_df[FEATURE_NAMES]
    y_train = train_df["target"].values
    X_test = test_df[FEATURE_NAMES]
    y_test = test_df["target"].values

    # 3. Naive Baseline (Predicting training set mean for test years)
    y_train_mean = float(np.mean(y_train))
    baseline_test_preds = np.full_like(y_test, y_train_mean)
    baseline_mae = float(mean_absolute_error(y_test, baseline_test_preds))

    # 4. Train Linear Regression Model
    lr_eval = LinearRegression()
    lr_eval.fit(X_train, y_train)
    lr_test_preds = lr_eval.predict(X_test)
    lr_metrics = compute_metrics(y_test, lr_test_preds)

    # 5. Train Random Forest Regressor Model
    rf_eval = RandomForestRegressor(n_estimators=50, max_depth=3, random_state=42)
    rf_eval.fit(X_train, y_train)
    rf_test_preds = rf_eval.predict(X_test)
    rf_metrics = compute_metrics(y_test, rf_test_preds)

    # 6. Model Selection & Low-Confidence Guard
    # Model with lower test MAE is selected as best
    if lr_metrics["mae"] <= rf_metrics["mae"]:
        best_model = "linear_regression"
        best_r2 = lr_metrics["r2"]
    else:
        best_model = "random_forest"
        best_r2 = rf_metrics["r2"]

    low_confidence_warning = None
    if best_r2 < 0:
        low_confidence_warning = "Low-confidence model performance: the selected model performed worse than a simple historical-mean baseline on the test data."

    # 7. Retrain Models on 100% of Usable Observations for Future Forecasting
    X_full = df[FEATURE_NAMES]
    y_full = df["target"].values

    # Full Linear Regression
    lr_full = LinearRegression()
    lr_full.fit(X_full, y_full)
    lr_full_preds = lr_full.predict(X_full)
    lr_res_std = float(np.std(y_full - lr_full_preds, ddof=1)) if len(y_full) > 1 else float(lr_metrics["rmse"])

    # Full Random Forest
    rf_full = RandomForestRegressor(n_estimators=50, max_depth=3, random_state=42)
    rf_full.fit(X_full, y_full)
    rf_full_preds = rf_full.predict(X_full)
    rf_res_std = float(np.std(y_full - rf_full_preds, ddof=1)) if len(y_full) > 1 else float(rf_metrics["rmse"])

    # Feature Importance / Coefficients
    lr_coefs = [
        {"feature_name": col, "importance_score": round(float(c), 4)}
        for col, c in zip(FEATURE_NAMES, lr_full.coef_)
    ]
    rf_importances = [
        {"feature_name": col, "importance_score": round(float(imp), 4)}
        for col, imp in zip(FEATURE_NAMES, rf_full.feature_importances_)
    ]

    # Backtest Points for Charting
    lr_backtest = [
        {"year": int(y), "actual": round(float(act), 2), "predicted": round(float(p), 2)}
        for y, act, p in zip(test_df["year"], y_test, lr_test_preds)
    ]
    rf_backtest = [
        {"year": int(y), "actual": round(float(act), 2), "predicted": round(float(p), 2)}
        for y, act, p in zip(test_df["year"], y_test, rf_test_preds)
    ]

    # Recursive Future Forecasts
    raw_history_years = [int(d["year"]) for d in raw_data]
    raw_history_values = [float(d["value"]) for d in raw_data]

    lr_forecast = recursive_forecast(
        lr_full, FEATURE_NAMES, raw_history_years, raw_history_values, min_year, forecast_horizon, lr_res_std
    )
    rf_forecast = recursive_forecast(
        rf_full, FEATURE_NAMES, raw_history_years, raw_history_values, min_year, forecast_horizon, rf_res_std
    )

    historical_series = [
        {"year": int(d["year"]), "actual": round(float(d["value"]), 2)}
        for d in raw_data
    ]

    return {
        "success": True,
        "usable_observations": usable_count,
        "required_observations": 8,
        "training_years": training_years,
        "test_years": test_years,
        "best_model": best_model,
        "baseline_mae": round(baseline_mae, 2),
        "low_confidence_warning": low_confidence_warning,
        "historical_series": historical_series,
        "models": {
            "linear_regression": {
                "model_name": "linear_regression",
                "display_name": "Linear Regression (Trend Baseline)",
                "metrics": lr_metrics,
                "backtest_series": lr_backtest,
                "forecast_series": lr_forecast,
                "feature_importance": lr_coefs,
            },
            "random_forest": {
                "model_name": "random_forest",
                "display_name": "Random Forest Regressor (Non-Linear Ensemble)",
                "metrics": rf_metrics,
                "backtest_series": rf_backtest,
                "forecast_series": rf_forecast,
                "feature_importance": rf_importances,
            },
        },
        "reliability_note": "Models are evaluated on a chronological split of annual observations. Projections represent statistical extrapolations with 95% confidence bands and should be interpreted alongside domain macroeconomic context.",
    }
