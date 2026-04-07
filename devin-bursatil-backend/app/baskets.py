"""
Virtual investment baskets module.
Each basket starts with 200 EUR virtual capital and tracks real market performance.
Includes ML predictions and Markowitz portfolio optimization.
"""
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
from scipy.optimize import minimize
from sklearn.linear_model import LinearRegression
from pydantic import BaseModel
from typing import Optional


# In-memory storage for baskets
baskets_db: dict[str, dict] = {}
basket_counter = 0

# Predefined stock universes
IBEX_STOCKS = {
    "SAN.MC": "Banco Santander",
    "BBVA.MC": "BBVA",
    "ITX.MC": "Inditex",
    "TEF.MC": "Telefonica",
    "IBE.MC": "Iberdrola",
    "REP.MC": "Repsol",
    "AMS.MC": "Amadeus",
    "FER.MC": "Ferrovial",
    "ENG.MC": "Enagas",
    "GRF.MC": "Grifols",
}

INTERNATIONAL_STOCKS = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Alphabet",
    "AMZN": "Amazon",
    "TSLA": "Tesla",
    "NVDA": "NVIDIA",
    "META": "Meta",
    "JPM": "JPMorgan",
    "V": "Visa",
    "JNJ": "Johnson & Johnson",
}


class BasketCreate(BaseModel):
    name: str
    symbols: list[str]
    market: str = "mixed"  # "ibex", "international", "mixed"
    strategy: str = "equal"  # "equal", "optimized", "ml_weighted"
    initial_capital: float = 200.0


class BasketPosition(BaseModel):
    symbol: str
    weight: float
    shares: float
    buy_price: float


def get_historical_returns(symbols: list[str], period: str = "1y") -> tuple[np.ndarray, list[str]]:
    """Fetch historical returns for a list of symbols."""
    valid_symbols = []
    all_closes = {}

    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period)
            if not hist.empty and len(hist) > 20:
                all_closes[symbol] = hist["Close"]
                valid_symbols.append(symbol)
        except Exception:
            continue

    if len(valid_symbols) < 2:
        return np.array([]), valid_symbols

    import pandas as pd
    df = pd.DataFrame(all_closes).dropna()
    if df.empty or len(df) < 20:
        return np.array([]), valid_symbols

    returns = df.pct_change().dropna().values
    return returns, valid_symbols


def optimize_markowitz(returns: np.ndarray, risk_free_rate: float = 0.02) -> np.ndarray:
    """Markowitz mean-variance optimization to maximize Sharpe ratio."""
    n_assets = returns.shape[1]
    mean_returns = np.mean(returns, axis=0) * 252
    cov_matrix = np.cov(returns.T) * 252

    def neg_sharpe(weights: np.ndarray) -> float:
        port_return = np.dot(weights, mean_returns)
        port_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        if port_vol == 0:
            return 0
        return -(port_return - risk_free_rate) / port_vol

    constraints = {"type": "eq", "fun": lambda w: np.sum(w) - 1}
    bounds = tuple((0.02, 0.5) for _ in range(n_assets))
    initial = np.array([1.0 / n_assets] * n_assets)

    result = minimize(neg_sharpe, initial, method="SLSQP", bounds=bounds, constraints=constraints)

    if result.success:
        return result.x
    return initial


def ml_predict_weights(returns: np.ndarray) -> np.ndarray:
    """Use linear regression to predict next-period returns and weight accordingly."""
    n_assets = returns.shape[1]
    predicted_returns = []

    for i in range(n_assets):
        asset_returns = returns[:, i]
        X = np.arange(len(asset_returns)).reshape(-1, 1)
        y = asset_returns

        model = LinearRegression()
        model.fit(X, y)
        next_return = model.predict([[len(asset_returns)]])[0]
        predicted_returns.append(next_return)

    predicted_returns = np.array(predicted_returns)
    # Shift to positive and normalize
    shifted = predicted_returns - predicted_returns.min() + 0.01
    weights = shifted / shifted.sum()

    # Ensure minimum weight of 2%
    weights = np.maximum(weights, 0.02)
    weights = weights / weights.sum()

    return weights


def predict_prices(symbol: str, days: int = 30) -> dict:
    """Predict future prices using linear regression on historical data."""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="6mo")

        if hist.empty or len(hist) < 30:
            return {"error": "Insufficient data"}

        closes = hist["Close"].values
        X = np.arange(len(closes)).reshape(-1, 1)

        model = LinearRegression()
        model.fit(X, closes)

        future_X = np.arange(len(closes), len(closes) + days).reshape(-1, 1)
        predictions = model.predict(future_X)

        score = model.score(X, closes)

        dates = []
        last_date = hist.index[-1]
        for i in range(1, days + 1):
            dates.append((last_date + timedelta(days=i)).strftime("%Y-%m-%d"))

        current_price = float(closes[-1])
        predicted_end = float(predictions[-1])
        expected_change_pct = round(((predicted_end - current_price) / current_price) * 100, 2)

        return {
            "symbol": symbol,
            "current_price": round(current_price, 2),
            "predictions": [
                {"date": d, "predicted_price": round(float(p), 2)}
                for d, p in zip(dates, predictions)
            ],
            "expected_change_percent": expected_change_pct,
            "model_r2_score": round(score, 4),
            "trend": "bullish" if expected_change_pct > 0 else "bearish",
        }
    except Exception as e:
        return {"error": str(e)}


def create_basket(config: BasketCreate) -> dict:
    """Create a virtual investment basket."""
    global basket_counter
    basket_counter += 1
    basket_id = f"basket_{basket_counter}"

    symbols = config.symbols
    returns_data, valid_symbols = get_historical_returns(symbols)

    if config.strategy == "optimized" and len(returns_data) > 0:
        weights = optimize_markowitz(returns_data)
    elif config.strategy == "ml_weighted" and len(returns_data) > 0:
        weights = ml_predict_weights(returns_data)
    else:
        weights = np.array([1.0 / len(valid_symbols)] * len(valid_symbols))

    # Build positions with real prices
    positions = []
    for i, symbol in enumerate(valid_symbols):
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1d")
            if hist.empty:
                continue
            price = float(hist["Close"].iloc[-1])
            allocation = config.initial_capital * float(weights[i])
            shares = allocation / price

            positions.append({
                "symbol": symbol,
                "name": IBEX_STOCKS.get(symbol, INTERNATIONAL_STOCKS.get(symbol, symbol)),
                "weight": round(float(weights[i]) * 100, 2),
                "shares": round(shares, 6),
                "buy_price": round(price, 2),
                "allocation": round(allocation, 2),
            })
        except Exception:
            continue

    basket = {
        "id": basket_id,
        "name": config.name,
        "market": config.market,
        "strategy": config.strategy,
        "initial_capital": config.initial_capital,
        "positions": positions,
        "created_at": datetime.now().isoformat(),
    }

    baskets_db[basket_id] = basket
    return basket


def get_basket_performance(basket_id: str) -> dict:
    """Calculate current performance of a basket."""
    if basket_id not in baskets_db:
        return {"error": "Basket not found"}

    basket = baskets_db[basket_id]
    total_current = 0.0
    total_cost = 0.0
    position_details = []

    for pos in basket["positions"]:
        try:
            ticker = yf.Ticker(pos["symbol"])
            hist = ticker.history(period="1d")
            current_price = float(hist["Close"].iloc[-1]) if not hist.empty else pos["buy_price"]
        except Exception:
            current_price = pos["buy_price"]

        current_value = current_price * pos["shares"]
        cost_basis = pos["buy_price"] * pos["shares"]
        gain_loss = current_value - cost_basis
        gain_pct = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0

        total_current += current_value
        total_cost += cost_basis

        position_details.append({
            "symbol": pos["symbol"],
            "name": pos["name"],
            "shares": pos["shares"],
            "buy_price": pos["buy_price"],
            "current_price": round(current_price, 2),
            "current_value": round(current_value, 2),
            "gain_loss": round(gain_loss, 2),
            "gain_loss_percent": round(gain_pct, 2),
            "weight": pos["weight"],
        })

    total_gain = total_current - total_cost
    total_gain_pct = (total_gain / total_cost * 100) if total_cost > 0 else 0

    return {
        "basket_id": basket_id,
        "name": basket["name"],
        "strategy": basket["strategy"],
        "market": basket["market"],
        "initial_capital": basket["initial_capital"],
        "current_value": round(total_current, 2),
        "total_gain_loss": round(total_gain, 2),
        "total_gain_loss_percent": round(total_gain_pct, 2),
        "positions": position_details,
        "created_at": basket["created_at"],
    }


def get_basket_history(basket_id: str, period: str = "1mo") -> dict:
    """Get historical performance of a basket over time."""
    if basket_id not in baskets_db:
        return {"error": "Basket not found"}

    basket = baskets_db[basket_id]
    import pandas as pd

    all_data = {}
    for pos in basket["positions"]:
        try:
            ticker = yf.Ticker(pos["symbol"])
            hist = ticker.history(period=period)
            if not hist.empty:
                all_data[pos["symbol"]] = {
                    "closes": hist["Close"],
                    "shares": pos["shares"],
                }
        except Exception:
            continue

    if not all_data:
        return {"error": "No historical data available"}

    # Get common dates
    all_dates = None
    for data in all_data.values():
        dates = set(data["closes"].index)
        if all_dates is None:
            all_dates = dates
        else:
            all_dates = all_dates.intersection(dates)

    sorted_dates = sorted(all_dates)
    history = []
    for date in sorted_dates:
        total_value = 0.0
        for data in all_data.values():
            if date in data["closes"].index:
                total_value += float(data["closes"][date]) * data["shares"]

        history.append({
            "date": date.strftime("%Y-%m-%d"),
            "value": round(total_value, 2),
        })

    return {
        "basket_id": basket_id,
        "name": basket["name"],
        "initial_capital": basket["initial_capital"],
        "history": history,
    }


def get_optimization_analysis(symbols: list[str]) -> dict:
    """Run full optimization analysis on a set of symbols."""
    returns_data, valid_symbols = get_historical_returns(symbols)

    if len(returns_data) == 0 or len(valid_symbols) < 2:
        return {"error": "Insufficient data for analysis"}

    mean_returns = np.mean(returns_data, axis=0) * 252
    cov_matrix = np.cov(returns_data.T) * 252
    volatilities = np.sqrt(np.diag(cov_matrix))

    # Individual metrics
    individual_metrics = []
    for i, symbol in enumerate(valid_symbols):
        sharpe = (mean_returns[i] - 0.02) / volatilities[i] if volatilities[i] > 0 else 0
        individual_metrics.append({
            "symbol": symbol,
            "name": IBEX_STOCKS.get(symbol, INTERNATIONAL_STOCKS.get(symbol, symbol)),
            "annual_return": round(float(mean_returns[i]) * 100, 2),
            "annual_volatility": round(float(volatilities[i]) * 100, 2),
            "sharpe_ratio": round(float(sharpe), 3),
        })

    # Optimized portfolio
    opt_weights = optimize_markowitz(returns_data)
    opt_return = float(np.dot(opt_weights, mean_returns))
    opt_vol = float(np.sqrt(np.dot(opt_weights.T, np.dot(cov_matrix, opt_weights))))
    opt_sharpe = (opt_return - 0.02) / opt_vol if opt_vol > 0 else 0

    # Equal weight portfolio
    eq_weights = np.array([1.0 / len(valid_symbols)] * len(valid_symbols))
    eq_return = float(np.dot(eq_weights, mean_returns))
    eq_vol = float(np.sqrt(np.dot(eq_weights.T, np.dot(cov_matrix, eq_weights))))
    eq_sharpe = (eq_return - 0.02) / eq_vol if eq_vol > 0 else 0

    # ML weighted
    ml_weights = ml_predict_weights(returns_data)
    ml_return = float(np.dot(ml_weights, mean_returns))
    ml_vol = float(np.sqrt(np.dot(ml_weights.T, np.dot(cov_matrix, ml_weights))))
    ml_sharpe = (ml_return - 0.02) / ml_vol if ml_vol > 0 else 0

    # Correlation matrix
    corr_matrix = np.corrcoef(returns_data.T)

    return {
        "symbols": valid_symbols,
        "individual_metrics": individual_metrics,
        "portfolios": {
            "equal_weight": {
                "weights": {s: round(float(w) * 100, 2) for s, w in zip(valid_symbols, eq_weights)},
                "expected_return": round(eq_return * 100, 2),
                "volatility": round(eq_vol * 100, 2),
                "sharpe_ratio": round(eq_sharpe, 3),
            },
            "optimized_markowitz": {
                "weights": {s: round(float(w) * 100, 2) for s, w in zip(valid_symbols, opt_weights)},
                "expected_return": round(opt_return * 100, 2),
                "volatility": round(opt_vol * 100, 2),
                "sharpe_ratio": round(opt_sharpe, 3),
            },
            "ml_weighted": {
                "weights": {s: round(float(w) * 100, 2) for s, w in zip(valid_symbols, ml_weights)},
                "expected_return": round(ml_return * 100, 2),
                "volatility": round(ml_vol * 100, 2),
                "sharpe_ratio": round(ml_sharpe, 3),
            },
        },
        "correlation_matrix": {
            valid_symbols[i]: {
                valid_symbols[j]: round(float(corr_matrix[i][j]), 3)
                for j in range(len(valid_symbols))
            }
            for i in range(len(valid_symbols))
        },
    }
