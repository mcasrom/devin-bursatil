"""
SQLite database module for persistent basket storage.
Uses /data/app.db when deployed with volume, falls back to local app.db for development.
"""
import sqlite3
import json
import os
from datetime import datetime


DB_PATH = os.environ.get("DB_PATH", "/data/app.db" if os.path.isdir("/data") else "app.db")


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Initialize the database tables."""
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS baskets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            market TEXT NOT NULL,
            strategy TEXT NOT NULL,
            initial_capital REAL NOT NULL DEFAULT 200.0,
            positions TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            symbol TEXT NOT NULL,
            target_price REAL NOT NULL,
            condition TEXT NOT NULL,
            name TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS basket_counter (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            counter INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.execute("""
        INSERT OR IGNORE INTO basket_counter (id, counter) VALUES (1, 0)
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alert_counter (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            counter INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.execute("""
        INSERT OR IGNORE INTO alert_counter (id, counter) VALUES (1, 0)
    """)
    conn.commit()
    conn.close()


# --- Basket DB operations ---

def db_next_basket_id() -> str:
    """Get the next basket ID and increment counter."""
    conn = get_connection()
    conn.execute("UPDATE basket_counter SET counter = counter + 1 WHERE id = 1")
    row = conn.execute("SELECT counter FROM basket_counter WHERE id = 1").fetchone()
    conn.commit()
    basket_id = f"basket_{row['counter']}"
    conn.close()
    return basket_id


def db_save_basket(basket: dict):
    """Save a basket to the database."""
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO baskets (id, name, market, strategy, initial_capital, positions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (basket["id"], basket["name"], basket["market"], basket["strategy"],
         basket["initial_capital"], json.dumps(basket["positions"]), basket["created_at"]),
    )
    conn.commit()
    conn.close()


def db_get_all_baskets() -> list[dict]:
    """Get all baskets from the database."""
    conn = get_connection()
    rows = conn.execute("SELECT * FROM baskets ORDER BY created_at DESC").fetchall()
    conn.close()
    baskets = []
    for row in rows:
        baskets.append({
            "id": row["id"],
            "name": row["name"],
            "market": row["market"],
            "strategy": row["strategy"],
            "initial_capital": row["initial_capital"],
            "positions": json.loads(row["positions"]),
            "created_at": row["created_at"],
        })
    return baskets


def db_get_basket(basket_id: str) -> dict | None:
    """Get a single basket by ID."""
    conn = get_connection()
    row = conn.execute("SELECT * FROM baskets WHERE id = ?", (basket_id,)).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "market": row["market"],
        "strategy": row["strategy"],
        "initial_capital": row["initial_capital"],
        "positions": json.loads(row["positions"]),
        "created_at": row["created_at"],
    }


def db_delete_basket(basket_id: str) -> bool:
    """Delete a basket. Returns True if deleted."""
    conn = get_connection()
    cursor = conn.execute("DELETE FROM baskets WHERE id = ?", (basket_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted


# --- Alert DB operations ---

def db_next_alert_id(symbol: str) -> str:
    """Get the next alert ID and increment counter."""
    conn = get_connection()
    conn.execute("UPDATE alert_counter SET counter = counter + 1 WHERE id = 1")
    row = conn.execute("SELECT counter FROM alert_counter WHERE id = 1").fetchone()
    conn.commit()
    alert_id = f"alert_{row['counter']}_{symbol}"
    conn.close()
    return alert_id


def db_save_alert(alert_id: str, alert: dict):
    """Save an alert to the database."""
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO alerts (id, symbol, target_price, condition, name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (alert_id, alert["symbol"], alert["target_price"], alert["condition"],
         alert.get("name"), alert["created_at"]),
    )
    conn.commit()
    conn.close()


def db_get_all_alerts() -> list[tuple[str, dict]]:
    """Get all alerts from the database as (id, alert_dict) tuples."""
    conn = get_connection()
    rows = conn.execute("SELECT * FROM alerts ORDER BY created_at DESC").fetchall()
    conn.close()
    alerts = []
    for row in rows:
        alerts.append((row["id"], {
            "symbol": row["symbol"],
            "target_price": row["target_price"],
            "condition": row["condition"],
            "name": row["name"],
            "created_at": row["created_at"],
        }))
    return alerts


def db_delete_alert(alert_id: str) -> bool:
    """Delete an alert. Returns True if deleted."""
    conn = get_connection()
    cursor = conn.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted
