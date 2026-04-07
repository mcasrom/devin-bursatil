from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import yfinance as yf
from datetime import datetime
from app.baskets import (
    BasketCreate, baskets_db, create_basket, get_basket_performance,
    get_basket_history, get_optimization_analysis, predict_prices,
    IBEX_STOCKS, INTERNATIONAL_STOCKS,
)

app = FastAPI(title="Devin Bursatil API", version="1.0.0")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# In-memory storage for portfolio and alerts
portfolio_db: dict[str, dict] = {}
alerts_db: dict[str, dict] = {}
alert_counter = 0


class PortfolioItem(BaseModel):
    symbol: str
    shares: float
    buy_price: float
    name: Optional[str] = None


class AlertConfig(BaseModel):
    symbol: str
    target_price: float
    condition: str  # "above" or "below"
    name: Optional[str] = None


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/stock/{symbol}")
async def get_stock(symbol: str):
    """Get current stock data and info."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period="1d")

        current_price = None
        if not hist.empty:
            current_price = round(float(hist["Close"].iloc[-1]), 2)

        return {
            "symbol": symbol.upper(),
            "name": info.get("shortName", info.get("longName", symbol)),
            "current_price": current_price,
            "currency": info.get("currency", "USD"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "dividend_yield": info.get("dividendYield"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "volume": info.get("volume"),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found: {str(e)}")


@app.get("/api/stock/{symbol}/history")
async def get_stock_history(
    symbol: str,
    period: str = Query(default="1mo", description="1d,5d,1mo,3mo,6mo,1y,2y,5y,max"),
    interval: str = Query(default="1d", description="1m,5m,15m,1h,1d,1wk,1mo"),
):
    """Get historical price data for charts."""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)

        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No history for {symbol}")

        data = []
        for date, row in hist.iterrows():
            data.append({
                "date": date.strftime("%Y-%m-%d %H:%M"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })

        return {"symbol": symbol.upper(), "period": period, "interval": interval, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/overview")
async def market_overview():
    """Get overview of major market indices."""
    indices = {
        "^GSPC": "S&P 500",
        "^DJI": "Dow Jones",
        "^IXIC": "NASDAQ",
        "^IBEX": "IBEX 35",
        "^STOXX50E": "Euro Stoxx 50",
    }
    results = []
    for symbol, name in indices.items():
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d")
            if len(hist) >= 2:
                current = round(float(hist["Close"].iloc[-1]), 2)
                previous = round(float(hist["Close"].iloc[-2]), 2)
                change = round(current - previous, 2)
                change_pct = round((change / previous) * 100, 2)
            elif len(hist) == 1:
                current = round(float(hist["Close"].iloc[-1]), 2)
                change = 0.0
                change_pct = 0.0
            else:
                continue
            results.append({
                "symbol": symbol,
                "name": name,
                "price": current,
                "change": change,
                "change_percent": change_pct,
            })
        except Exception:
            continue
    return {"indices": results}


@app.get("/api/market/trending")
async def trending_stocks():
    """Get trending/popular stocks."""
    popular = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "SAN.MC", "ITX.MC", "TEF.MC"]
    results = []
    for symbol in popular:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d")
            info = ticker.info
            if len(hist) >= 2:
                current = round(float(hist["Close"].iloc[-1]), 2)
                previous = round(float(hist["Close"].iloc[-2]), 2)
                change_pct = round(((current - previous) / previous) * 100, 2)
            elif len(hist) == 1:
                current = round(float(hist["Close"].iloc[-1]), 2)
                change_pct = 0.0
            else:
                continue
            results.append({
                "symbol": symbol,
                "name": info.get("shortName", symbol),
                "price": current,
                "change_percent": change_pct,
            })
        except Exception:
            continue
    return {"stocks": results}


# --- Portfolio endpoints ---

@app.get("/api/portfolio")
async def get_portfolio():
    """Get all portfolio positions with current values."""
    positions = []
    total_value = 0.0
    total_cost = 0.0

    for pid, item in portfolio_db.items():
        try:
            ticker = yf.Ticker(item["symbol"])
            hist = ticker.history(period="1d")
            current_price = round(float(hist["Close"].iloc[-1]), 2) if not hist.empty else item["buy_price"]
        except Exception:
            current_price = item["buy_price"]

        market_value = round(current_price * item["shares"], 2)
        cost_basis = round(item["buy_price"] * item["shares"], 2)
        gain_loss = round(market_value - cost_basis, 2)
        gain_loss_pct = round((gain_loss / cost_basis) * 100, 2) if cost_basis > 0 else 0.0

        total_value += market_value
        total_cost += cost_basis

        positions.append({
            "id": pid,
            "symbol": item["symbol"],
            "name": item.get("name", item["symbol"]),
            "shares": item["shares"],
            "buy_price": item["buy_price"],
            "current_price": current_price,
            "market_value": market_value,
            "cost_basis": cost_basis,
            "gain_loss": gain_loss,
            "gain_loss_percent": gain_loss_pct,
        })

    total_gain = round(total_value - total_cost, 2)
    total_gain_pct = round((total_gain / total_cost) * 100, 2) if total_cost > 0 else 0.0

    return {
        "positions": positions,
        "summary": {
            "total_value": round(total_value, 2),
            "total_cost": round(total_cost, 2),
            "total_gain_loss": total_gain,
            "total_gain_loss_percent": total_gain_pct,
        },
    }


@app.post("/api/portfolio")
async def add_to_portfolio(item: PortfolioItem):
    """Add a stock position to the portfolio."""
    global portfolio_db
    pid = f"pos_{len(portfolio_db) + 1}_{item.symbol}"

    if not item.name:
        try:
            ticker = yf.Ticker(item.symbol)
            item.name = ticker.info.get("shortName", item.symbol)
        except Exception:
            item.name = item.symbol

    portfolio_db[pid] = {
        "symbol": item.symbol.upper(),
        "shares": item.shares,
        "buy_price": item.buy_price,
        "name": item.name,
        "added_at": datetime.now().isoformat(),
    }
    return {"id": pid, "message": f"Added {item.shares} shares of {item.symbol}"}


@app.delete("/api/portfolio/{position_id}")
async def remove_from_portfolio(position_id: str):
    """Remove a position from the portfolio."""
    if position_id not in portfolio_db:
        raise HTTPException(status_code=404, detail="Position not found")
    del portfolio_db[position_id]
    return {"message": "Position removed"}


# --- Alert endpoints ---

@app.get("/api/alerts")
async def get_alerts():
    """Get all configured alerts with current status."""
    results = []
    for aid, alert in alerts_db.items():
        try:
            ticker = yf.Ticker(alert["symbol"])
            hist = ticker.history(period="1d")
            current_price = round(float(hist["Close"].iloc[-1]), 2) if not hist.empty else None
        except Exception:
            current_price = None

        triggered = False
        if current_price is not None:
            if alert["condition"] == "above" and current_price >= alert["target_price"]:
                triggered = True
            elif alert["condition"] == "below" and current_price <= alert["target_price"]:
                triggered = True

        results.append({
            "id": aid,
            "symbol": alert["symbol"],
            "name": alert.get("name", alert["symbol"]),
            "target_price": alert["target_price"],
            "condition": alert["condition"],
            "current_price": current_price,
            "triggered": triggered,
            "created_at": alert.get("created_at"),
        })
    return {"alerts": results}


@app.post("/api/alerts")
async def create_alert(config: AlertConfig):
    """Create a price alert."""
    global alert_counter
    alert_counter += 1
    aid = f"alert_{alert_counter}_{config.symbol}"

    if not config.name:
        try:
            ticker = yf.Ticker(config.symbol)
            config.name = ticker.info.get("shortName", config.symbol)
        except Exception:
            config.name = config.symbol

    alerts_db[aid] = {
        "symbol": config.symbol.upper(),
        "target_price": config.target_price,
        "condition": config.condition,
        "name": config.name,
        "created_at": datetime.now().isoformat(),
    }
    return {"id": aid, "message": f"Alert created for {config.symbol} {config.condition} ${config.target_price}"}


@app.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete an alert."""
    if alert_id not in alerts_db:
        raise HTTPException(status_code=404, detail="Alert not found")
    del alerts_db[alert_id]
    return {"message": "Alert deleted"}


@app.get("/api/search")
async def search_stocks(q: str = Query(..., description="Search query")):
    """Search for stocks by name or symbol."""
    try:
        ticker = yf.Ticker(q)
        info = ticker.info
        if info and info.get("shortName"):
            return {
                "results": [{
                    "symbol": q.upper(),
                    "name": info.get("shortName", q),
                    "sector": info.get("sector", "N/A"),
                    "industry": info.get("industry", "N/A"),
                }]
            }
        return {"results": []}
    except Exception:
        return {"results": []}


# --- Basket endpoints ---

@app.get("/api/stocks/universe")
async def get_stock_universe():
    """Get available stock universes (IBEX + International)."""
    return {
        "ibex": [{"symbol": s, "name": n} for s, n in IBEX_STOCKS.items()],
        "international": [{"symbol": s, "name": n} for s, n in INTERNATIONAL_STOCKS.items()],
    }


@app.post("/api/baskets")
async def api_create_basket(config: BasketCreate):
    """Create a new virtual investment basket (200 EUR default)."""
    try:
        basket = create_basket(config)
        return basket
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/baskets")
async def list_baskets():
    """List all baskets."""
    results = []
    for bid, basket in baskets_db.items():
        results.append({
            "id": bid,
            "name": basket["name"],
            "market": basket["market"],
            "strategy": basket["strategy"],
            "initial_capital": basket["initial_capital"],
            "created_at": basket["created_at"],
            "num_positions": len(basket["positions"]),
        })
    return {"baskets": results}


@app.get("/api/baskets/{basket_id}")
async def get_basket(basket_id: str):
    """Get basket performance details."""
    result = get_basket_performance(basket_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/baskets/{basket_id}/history")
async def api_basket_history(
    basket_id: str,
    period: str = Query(default="1mo", description="1mo,3mo,6mo,1y"),
):
    """Get historical value of a basket over time."""
    result = get_basket_history(basket_id, period)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.delete("/api/baskets/{basket_id}")
async def delete_basket(basket_id: str):
    """Delete a basket."""
    if basket_id not in baskets_db:
        raise HTTPException(status_code=404, detail="Basket not found")
    del baskets_db[basket_id]
    return {"message": "Basket deleted"}


# --- ML / Optimization endpoints ---

@app.get("/api/predict/{symbol}")
async def api_predict(
    symbol: str,
    days: int = Query(default=30, description="Days to predict"),
):
    """Predict future stock prices using ML."""
    result = predict_prices(symbol, days)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/optimize")
async def api_optimize(symbols: list[str]):
    """Run portfolio optimization analysis (Markowitz + ML)."""
    if len(symbols) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 symbols")
    result = get_optimization_analysis(symbols)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
