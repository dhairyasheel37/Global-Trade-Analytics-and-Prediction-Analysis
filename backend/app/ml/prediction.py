"""
Advanced Machine Learning & Econometric Time-Series Forecasting Engine.
Provides 4 complementary model architectures:
1. Linear Regression (Parametric Trend + Recursive Multi-Lags)
2. Random Forest Regressor (Non-Linear Bagging Ensemble)
3. ARIMA (Autoregressive Integrated Moving Average with AIC Optimization)
4. Holt-Winters Exponential Smoothing (Damped Additive State-Space ETS)

Implements rigorous chronological backtesting, side-by-side metric comparison
(MAE, RMSE, R2, MAPE, AIC, BIC), and multi-step future projections with 95% confidence bounds.
"""
from __future__ import annotations

import warnings
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing

# Suppress convergence and estimation warnings for cleaner logs
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

FEATURE_NAMES = ["lag_1", "lag_2", "lag_3", "rolling_mean_3", "pct_change_1", "year_trend"]


def prepare_time_series_features(raw_data: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Transforms raw annual observations into a strictly leakage-free feature DataFrame.
    Features strictly use past observations:
    - lag_1: y(t-1)
    - lag_2: y(t-2)
    - lag_3: y(t-3)
    - rolling_mean_3: (lag_1 + lag_2 + lag_3) / 3
    - pct_change_1: (lag_1 - lag_2) / lag_2
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

    df["lag_1"] = df["value"].shift(1)
    df["lag_2"] = df["value"].shift(2)
    df["lag_3"] = df["value"].shift(3)
    df["rolling_mean_3"] = (df["lag_1"] + df["lag_2"] + df["lag_3"]) / 3.0

    diff = df["lag_1"] - df["lag_2"]
    base = df["lag_2"].replace(0.0, np.nan)
    df["pct_change_1"] = (diff / base).fillna(0.0)

    df["year_trend"] = df["year"] - min_year
    df["target"] = df["value"]

    clean_df = df.dropna(subset=["lag_1", "lag_2", "lag_3", "rolling_mean_3"]).reset_index(drop=True)
    return clean_df


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    n_params: int = 2,
    total_observations: Optional[int] = None,
) -> Dict[str, float]:
    """
    Computes standard evaluation metrics: MAE, RMSE, R2, MAPE, AIC, and BIC.
    Uses Gaussian log-likelihood formulation for information criteria.
    """
    mae = float(mean_absolute_error(y_true, y_pred))
    try:
        rmse = float(root_mean_squared_error(y_true, y_pred))
    except (AttributeError, TypeError):
        rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

    r2 = float(r2_score(y_true, y_pred)) if len(y_true) > 1 else 0.0

    denom = np.where(np.abs(y_true) > 1e-5, np.abs(y_true), 1e-5)
    mape = float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)

    # Information Criteria (AIC & BIC) calculation based on residual variance
    n = total_observations or len(y_true)
    residuals = y_true - y_pred
    rss = float(np.sum(residuals ** 2))
    variance = max(rss / max(1, n), 1e-6)

    # Log-likelihood under Gaussian error: ln(L) = -n/2 * ln(2*pi*sigma^2) - n/2
    log_lik = -0.5 * n * (np.log(2.0 * np.pi * variance) + 1.0)
    aic = 2.0 * n_params - 2.0 * log_lik
    bic = n_params * np.log(max(1, n)) - 2.0 * log_lik

    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "mape": round(mape, 2),
        "aic": round(aic, 2),
        "bic": round(bic, 2),
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
    Generates multi-step future projections recursively with 95% confidence intervals
    for scikit-learn models.
    """
    forecast_points = []
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
        pred_val = max(0.0, pred_raw)

        margin = 1.96 * residual_std * np.sqrt(h)
        lower_bound = max(0.0, pred_val - margin)
        upper_bound = pred_val + margin

        prev_val = sim_values[-1]
        growth_pct = round(((pred_val - prev_val) / prev_val) * 100.0, 2) if prev_val > 0 else None

        forecast_points.append({
            "year": int(target_year),
            "predicted": round(pred_val, 2),
            "lower_bound": round(lower_bound, 2),
            "upper_bound": round(upper_bound, 2),
            "growth_pct": growth_pct,
        })

        sim_years.append(target_year)
        sim_values.append(pred_val)

    return forecast_points


def train_arima_model(
    raw_years: List[int],
    raw_values: List[float],
    test_size: int,
    forecast_horizon: int,
) -> Dict[str, Any]:
    """
    Fits ARIMA model with automated (p, d, q) grid search minimizing AIC,
    generates backtest predictions and future analytical forecast bounds.
    """
    n_total = len(raw_values)
    train_vals = np.array(raw_values[:-test_size], dtype=float)
    test_vals = np.array(raw_values[-test_size:], dtype=float)
    test_years = raw_years[-test_size:]

    # Grid search candidate orders
    candidate_orders = [(1, 1, 0), (0, 1, 1), (1, 1, 1), (2, 1, 0), (0, 1, 0)]
    best_aic = float("inf")
    best_order = (1, 1, 0)
    best_train_res = None

    for order in candidate_orders:
        try:
            m = ARIMA(train_vals, order=order)
            res = m.fit()
            if not np.isnan(res.aic) and res.aic < best_aic:
                best_aic = res.aic
                best_order = order
                best_train_res = res
        except Exception:
            continue

    if best_train_res is None:
        # Fallback to order (0, 1, 0) random walk with drift
        best_order = (0, 1, 0)
        m = ARIMA(train_vals, order=best_order)
        best_train_res = m.fit()

    # Backtest predictions on test set
    arima_test_preds_raw = best_train_res.forecast(steps=test_size)
    arima_test_preds = np.array([max(0.0, float(v)) for v in arima_test_preds_raw])

    # Compute test metrics
    metrics = compute_metrics(
        y_true=test_vals,
        y_pred=arima_test_preds,
        n_params=sum(best_order) + 1,
        total_observations=n_total,
    )
    # Prefer statsmodels official analytical AIC/BIC if available
    if not np.isnan(best_train_res.aic) and not np.isinf(best_train_res.aic):
        metrics["aic"] = round(float(best_train_res.aic), 2)
    if not np.isnan(best_train_res.bic) and not np.isinf(best_train_res.bic):
        metrics["bic"] = round(float(best_train_res.bic), 2)

    # Backtest series for charting
    backtest_series = [
        {"year": int(y), "actual": round(float(act), 2), "predicted": round(float(p), 2)}
        for y, act, p in zip(test_years, test_vals, arima_test_preds)
    ]

    # Refit on 100% of observations for forward projection
    full_vals = np.array(raw_values, dtype=float)
    m_full = ARIMA(full_vals, order=best_order)
    res_full = m_full.fit()

    forecast_obj = res_full.get_forecast(steps=forecast_horizon)
    pred_means = forecast_obj.predicted_mean
    conf_int = forecast_obj.conf_int(alpha=0.05)

    forecast_series = []
    last_val = full_vals[-1]
    last_year = raw_years[-1]

    for h in range(forecast_horizon):
        target_year = last_year + h + 1
        p_val = max(0.0, float(pred_means[h]))
        lb = max(0.0, float(conf_int[h][0]))
        ub = max(p_val, float(conf_int[h][1]))
        prev = last_val if h == 0 else max(0.0, float(pred_means[h - 1]))
        growth_pct = round(((p_val - prev) / prev) * 100.0, 2) if prev > 0 else None

        forecast_series.append({
            "year": int(target_year),
            "predicted": round(p_val, 2),
            "lower_bound": round(lb, 2),
            "upper_bound": round(ub, 2),
            "growth_pct": growth_pct,
        })

    # ARIMA parameter coefficients
    params_summary = [
        {"feature_name": name, "importance_score": round(float(val), 4)}
        for name, val in zip(res_full.param_names, res_full.params)
    ]

    return {
        "model_name": "arima",
        "display_name": f"ARIMA{best_order} (Box-Jenkins Univariate)",
        "model_family": "TIME_SERIES",
        "model_order": f"ARIMA{best_order}",
        "metrics": metrics,
        "backtest_series": backtest_series,
        "forecast_series": forecast_series,
        "feature_importance": params_summary,
    }


def train_exponential_smoothing_model(
    raw_years: List[int],
    raw_values: List[float],
    test_size: int,
    forecast_horizon: int,
) -> Dict[str, Any]:
    """
    Fits Holt-Winters Exponential Smoothing (ETS) with damped additive trend,
    generates backtest predictions and future confidence intervals.
    """
    n_total = len(raw_values)
    train_vals = np.array(raw_values[:-test_size], dtype=float)
    test_vals = np.array(raw_values[-test_size:], dtype=float)
    test_years = raw_years[-test_size:]

    # Fit damped additive Holt-Winters model
    try:
        ets_train = ExponentialSmoothing(
            train_vals,
            trend="add",
            damped_trend=True,
            initialization_method="estimated",
        ).fit()
    except Exception:
        ets_train = ExponentialSmoothing(
            train_vals,
            trend="add",
            damped_trend=False,
            initialization_method="estimated",
        ).fit()

    ets_test_preds_raw = ets_train.forecast(steps=test_size)
    ets_test_preds = np.array([max(0.0, float(v)) for v in ets_test_preds_raw])

    metrics = compute_metrics(
        y_true=test_vals,
        y_pred=ets_test_preds,
        n_params=3,
        total_observations=n_total,
    )
    if hasattr(ets_train, "aic") and not np.isnan(ets_train.aic) and not np.isinf(ets_train.aic):
        metrics["aic"] = round(float(ets_train.aic), 2)
    if hasattr(ets_train, "bic") and not np.isnan(ets_train.bic) and not np.isinf(ets_train.bic):
        metrics["bic"] = round(float(ets_train.bic), 2)

    backtest_series = [
        {"year": int(y), "actual": round(float(act), 2), "predicted": round(float(p), 2)}
        for y, act, p in zip(test_years, test_vals, ets_test_preds)
    ]

    # Refit on 100% of observations
    full_vals = np.array(raw_values, dtype=float)
    try:
        ets_full = ExponentialSmoothing(
            full_vals,
            trend="add",
            damped_trend=True,
            initialization_method="estimated",
        ).fit()
    except Exception:
        ets_full = ExponentialSmoothing(
            full_vals,
            trend="add",
            damped_trend=False,
            initialization_method="estimated",
        ).fit()

    full_preds = ets_full.forecast(steps=forecast_horizon)
    residuals = full_vals - ets_full.fittedvalues
    res_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else float(metrics["rmse"])

    forecast_series = []
    last_val = full_vals[-1]
    last_year = raw_years[-1]

    for h in range(forecast_horizon):
        target_year = last_year + h + 1
        p_val = max(0.0, float(full_preds[h]))
        # Standard error grows with forecast horizon sqrt(h+1)
        margin = 1.96 * res_std * np.sqrt(h + 1)
        lb = max(0.0, p_val - margin)
        ub = p_val + margin
        prev = last_val if h == 0 else max(0.0, float(full_preds[h - 1]))
        growth_pct = round(((p_val - prev) / prev) * 100.0, 2) if prev > 0 else None

        forecast_series.append({
            "year": int(target_year),
            "predicted": round(p_val, 2),
            "lower_bound": round(lb, 2),
            "upper_bound": round(ub, 2),
            "growth_pct": growth_pct,
        })

    # Model smoothing parameter weights
    smoothing_params = [
        {"feature_name": "Smoothing Level (alpha)", "importance_score": round(float(ets_full.params.get("smoothing_level", 0.3)), 4)},
        {"feature_name": "Smoothing Trend (beta)", "importance_score": round(float(ets_full.params.get("smoothing_trend", 0.1)), 4)},
        {"feature_name": "Damping Factor (phi)", "importance_score": round(float(ets_full.params.get("damping_trend", 0.9)), 4)},
    ]

    return {
        "model_name": "holt_winters",
        "display_name": "Holt-Winters (Damped Additive ETS)",
        "model_family": "TIME_SERIES",
        "model_order": "ETS(A, Ad, N)",
        "metrics": metrics,
        "backtest_series": backtest_series,
        "forecast_series": forecast_series,
        "feature_importance": smoothing_params,
    }


def train_and_forecast_pipeline(
    raw_data: List[Dict[str, Any]],
    forecast_horizon: int = 3,
) -> Dict[str, Any]:
    """
    Complete ML training, chronological backtesting, side-by-side benchmarking,
    and multi-step forecasting across 4 complementary model architectures:
    1. Linear Regression
    2. Random Forest Regressor
    3. ARIMA (p, d, q)
    4. Holt-Winters (ETS)
    """
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
    raw_history_years = [int(d["year"]) for d in raw_data]
    raw_history_values = [float(d["value"]) for d in raw_data]

    # Chronological Split (Testing on the last 2-3 observed years)
    test_size = max(2, min(3, int(usable_count * 0.25)))
    train_df = df.iloc[:-test_size].copy()
    test_df = df.iloc[-test_size:].copy()

    training_years = [int(y) for y in train_df["year"].tolist()]
    test_years = [int(y) for y in test_df["year"].tolist()]

    X_train = train_df[FEATURE_NAMES]
    y_train = train_df["target"].values
    X_test = test_df[FEATURE_NAMES]
    y_test = test_df["target"].values

    # Naive Mean Baseline
    y_train_mean = float(np.mean(y_train))
    baseline_test_preds = np.full_like(y_test, y_train_mean)
    baseline_mae = float(mean_absolute_error(y_test, baseline_test_preds))

    # --- 1. Linear Regression Model ---
    lr_eval = LinearRegression()
    lr_eval.fit(X_train, y_train)
    lr_test_preds = lr_eval.predict(X_test)
    lr_metrics = compute_metrics(y_test, lr_test_preds, n_params=len(FEATURE_NAMES) + 1, total_observations=len(df))

    X_full = df[FEATURE_NAMES]
    y_full = df["target"].values
    lr_full = LinearRegression()
    lr_full.fit(X_full, y_full)
    lr_full_preds = lr_full.predict(X_full)
    lr_res_std = float(np.std(y_full - lr_full_preds, ddof=1)) if len(y_full) > 1 else float(lr_metrics["rmse"])

    lr_forecast = recursive_forecast(
        lr_full, FEATURE_NAMES, raw_history_years, raw_history_values, min_year, forecast_horizon, lr_res_std
    )
    lr_backtest = [
        {"year": int(y), "actual": round(float(act), 2), "predicted": round(float(p), 2)}
        for y, act, p in zip(test_df["year"], y_test, lr_test_preds)
    ]
    lr_coefs = [
        {"feature_name": col, "importance_score": round(float(c), 4)}
        for col, c in zip(FEATURE_NAMES, lr_full.coef_)
    ]

    # --- 2. Random Forest Regressor Model ---
    rf_eval = RandomForestRegressor(n_estimators=50, max_depth=3, random_state=42)
    rf_eval.fit(X_train, y_train)
    rf_test_preds = rf_eval.predict(X_test)
    rf_metrics = compute_metrics(y_test, rf_test_preds, n_params=8, total_observations=len(df))

    rf_full = RandomForestRegressor(n_estimators=50, max_depth=3, random_state=42)
    rf_full.fit(X_full, y_full)
    rf_full_preds = rf_full.predict(X_full)
    rf_res_std = float(np.std(y_full - rf_full_preds, ddof=1)) if len(y_full) > 1 else float(rf_metrics["rmse"])

    rf_forecast = recursive_forecast(
        rf_full, FEATURE_NAMES, raw_history_years, raw_history_values, min_year, forecast_horizon, rf_res_std
    )
    rf_backtest = [
        {"year": int(y), "actual": round(float(act), 2), "predicted": round(float(p), 2)}
        for y, act, p in zip(test_df["year"], y_test, rf_test_preds)
    ]
    rf_importances = [
        {"feature_name": col, "importance_score": round(float(imp), 4)}
        for col, imp in zip(FEATURE_NAMES, rf_full.feature_importances_)
    ]

    # --- 3. ARIMA Model ---
    arima_result = train_arima_model(
        raw_years=raw_history_years,
        raw_values=raw_history_values,
        test_size=test_size,
        forecast_horizon=forecast_horizon,
    )

    # --- 4. Holt-Winters ETS Model ---
    ets_result = train_exponential_smoothing_model(
        raw_years=raw_history_years,
        raw_values=raw_history_values,
        test_size=test_size,
        forecast_horizon=forecast_horizon,
    )

    # Dictionary of all models
    models_dict = {
        "linear_regression": {
            "model_name": "linear_regression",
            "display_name": "Linear Regression (Trend Baseline)",
            "model_family": "MACHINE_LEARNING",
            "model_order": "OLS + 6 Multi-Lags",
            "metrics": lr_metrics,
            "backtest_series": lr_backtest,
            "forecast_series": lr_forecast,
            "feature_importance": lr_coefs,
            "is_best": False,
        },
        "random_forest": {
            "model_name": "random_forest",
            "display_name": "Random Forest Regressor (Non-Linear Ensemble)",
            "model_family": "MACHINE_LEARNING",
            "model_order": "50 Trees (Depth 3)",
            "metrics": rf_metrics,
            "backtest_series": rf_backtest,
            "forecast_series": rf_forecast,
            "feature_importance": rf_importances,
            "is_best": False,
        },
        "arima": arima_result,
        "holt_winters": ets_result,
    }

    # Model Selection: Pick model with lowest test MAE
    model_maes = {k: v["metrics"]["mae"] for k, v in models_dict.items()}
    best_model = min(model_maes, key=model_maes.get)
    models_dict[best_model]["is_best"] = True
    best_r2 = models_dict[best_model]["metrics"]["r2"]

    low_confidence_warning = None
    if best_r2 < 0:
        low_confidence_warning = "Low-confidence model performance: the selected model performed worse than a simple historical-mean baseline on the test data."

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
        "models": models_dict,
        "reliability_note": "Models are evaluated on a chronological split of annual observations. Projections represent statistical extrapolations with 95% confidence bands and should be interpreted alongside domain macroeconomic context.",
    }
