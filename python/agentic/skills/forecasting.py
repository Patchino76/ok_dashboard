"""
skills/forecasting.py — Time series forecasting functions.
"""

import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def prophet_forecast(df: pd.DataFrame, column: str, periods: int = 1440,
                     freq: str = "1min", output_dir: str = "output") -> dict:
    """
    Forecast using Facebook Prophet.
    
    Args:
        df: DataFrame with DatetimeIndex
        column: column to forecast
        periods: number of future periods to forecast
        freq: frequency string ('1min', '5min', '1h', etc.)
        output_dir: where to save charts
    
    Returns:
        {"figures": [path], "stats": {trend, changepoints, forecast_range}, "summary": str}
    """
    try:
        from prophet import Prophet
    except ImportError:
        return {"figures": [], "stats": {}, "summary": "Prophet not installed. Skipping forecast."}
    
    data = df[[column]].dropna()
    if len(data) < 100:
        return {"figures": [], "stats": {}, "summary": f"Insufficient data ({len(data)} points)."}
    
    # Prepare Prophet format
    prophet_df = data.reset_index()
    prophet_df.columns = ["ds", "y"]
    prophet_df["ds"] = pd.to_datetime(prophet_df["ds"])
    
    # Fit model
    model = Prophet(
        daily_seasonality=True,
        weekly_seasonality=True,
        changepoint_prior_scale=0.05,
    )
    model.fit(prophet_df)
    
    # Forecast
    future = model.make_future_dataframe(periods=periods, freq=freq)
    forecast = model.predict(future)
    
    # Changepoints
    changepoints = model.changepoints.tolist() if hasattr(model, 'changepoints') else []
    n_changepoints = len(changepoints)
    
    # Trend direction
    trend_start = float(forecast["trend"].iloc[0])
    trend_end = float(forecast["trend"].iloc[-1])
    trend_direction = "increasing" if trend_end > trend_start else "decreasing" if trend_end < trend_start else "flat"
    trend_change_pct = round((trend_end - trend_start) / abs(trend_start) * 100, 2) if trend_start != 0 else 0
    
    # Forecast range (last `periods` rows)
    forecast_future = forecast.iloc[-periods:]
    forecast_mean = round(float(forecast_future["yhat"].mean()), 2)
    forecast_low = round(float(forecast_future["yhat_lower"].mean()), 2)
    forecast_high = round(float(forecast_future["yhat_upper"].mean()), 2)
    
    # Plot
    fig, axes = plt.subplots(2, 1, figsize=(16, 10))
    
    # Main forecast plot
    ax = axes[0]
    ax.plot(prophet_df["ds"], prophet_df["y"], alpha=0.5, linewidth=0.5, color='steelblue', label='Actual')
    ax.plot(forecast["ds"], forecast["yhat"], color='red', linewidth=1, label='Forecast')
    ax.fill_between(forecast["ds"], forecast["yhat_lower"], forecast["yhat_upper"],
                     alpha=0.15, color='red', label='95% CI')
    for cp in changepoints[:10]:
        ax.axvline(cp, color='gray', linestyle='--', alpha=0.3)
    ax.set_title(f"Prophet Forecast — {column} ({trend_direction}, {trend_change_pct:+.1f}%)",
                 fontsize=12, fontweight='bold')
    ax.set_ylabel(column)
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.3)
    
    # Components: trend
    ax2 = axes[1]
    ax2.plot(forecast["ds"], forecast["trend"], color='navy', linewidth=1.5)
    ax2.set_title("Trend Component", fontsize=11)
    ax2.set_ylabel("Trend")
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    path = os.path.join(output_dir, f"forecast_{column}.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    stats = {
        "trend_direction": trend_direction,
        "trend_change_pct": trend_change_pct,
        "n_changepoints": n_changepoints,
        "forecast_mean": forecast_mean,
        "forecast_ci_low": forecast_low,
        "forecast_ci_high": forecast_high,
        "forecast_periods": periods,
        "data_points_used": len(prophet_df),
    }
    
    lines = [f"Prophet Forecast for {column}:"]
    lines.append(f"  Trend: {trend_direction} ({trend_change_pct:+.1f}%)")
    lines.append(f"  Changepoints detected: {n_changepoints}")
    lines.append(f"  Forecast ({periods} periods): mean={forecast_mean}, CI=[{forecast_low}, {forecast_high}]")
    
    return {"figures": [path], "stats": stats, "summary": "\n".join(lines)}


def seasonal_decomposition(df: pd.DataFrame, column: str, period: int | None = None,
                           output_dir: str = "output") -> dict:
    """
    Decompose time series into trend, seasonal, and residual components.
    
    Args:
        df: DataFrame with DatetimeIndex
        column: column to decompose
        period: seasonal period in data points (auto-detected if None)
        output_dir: where to save charts
    
    Returns:
        {"figures": [path], "stats": {seasonal_strength, trend_strength}, "summary": str}
    """
    try:
        from statsmodels.tsa.seasonal import seasonal_decompose
    except ImportError:
        return {"figures": [], "stats": {}, "summary": "statsmodels not installed."}
    
    data = df[column].dropna()
    if len(data) < 100:
        return {"figures": [], "stats": {}, "summary": f"Insufficient data ({len(data)} points)."}
    
    # Auto-detect period if not given
    if period is None:
        if isinstance(data.index, pd.DatetimeIndex):
            freq = pd.infer_freq(data.index)
            if freq and 'min' in str(freq).lower():
                period = 1440  # daily seasonality for minute data
            elif freq and 'h' in str(freq).lower():
                period = 24  # daily for hourly
            else:
                period = min(144, len(data) // 3)  # fallback
        else:
            period = min(144, len(data) // 3)
    
    period = min(period, len(data) // 2)
    
    result = seasonal_decompose(data, model='additive', period=period, extrapolate_trend='freq')
    
    # Strength metrics
    var_resid = float(result.resid.dropna().var())
    var_seasonal = float(result.seasonal.dropna().var())
    var_remainder = var_resid
    seasonal_strength = round(max(0, 1 - var_remainder / (var_seasonal + var_remainder)), 3) if (var_seasonal + var_remainder) > 0 else 0
    
    trend_data = result.trend.dropna()
    trend_range = float(trend_data.max() - trend_data.min())
    data_range = float(data.max() - data.min())
    trend_strength = round(trend_range / data_range, 3) if data_range > 0 else 0
    
    # Plot decomposition
    fig, axes = plt.subplots(4, 1, figsize=(16, 12), sharex=True)
    
    axes[0].plot(data.index, data.values, alpha=0.7, linewidth=0.5)
    axes[0].set_ylabel("Observed")
    axes[0].set_title(f"Seasonal Decomposition — {column} (period={period})",
                      fontsize=12, fontweight='bold')
    
    axes[1].plot(result.trend.index, result.trend.values, color='red', linewidth=1)
    axes[1].set_ylabel("Trend")
    
    axes[2].plot(result.seasonal.index, result.seasonal.values, color='green', linewidth=0.5)
    axes[2].set_ylabel("Seasonal")
    
    axes[3].plot(result.resid.index, result.resid.values, color='purple', linewidth=0.5, alpha=0.7)
    axes[3].set_ylabel("Residual")
    axes[3].set_xlabel("Time")
    
    for ax in axes:
        ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    path = os.path.join(output_dir, f"decomposition_{column}.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    
    stats = {
        "period": period,
        "seasonal_strength": seasonal_strength,
        "trend_strength": trend_strength,
        "trend_range": round(trend_range, 4),
    }
    
    lines = [f"Seasonal Decomposition for {column}:"]
    lines.append(f"  Period: {period} data points")
    lines.append(f"  Seasonal strength: {seasonal_strength:.3f}")
    lines.append(f"  Trend strength: {trend_strength:.3f}")
    
    return {"figures": [path], "stats": stats, "summary": "\n".join(lines)}
