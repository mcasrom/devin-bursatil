# Devin Bursatil - Backend API

FastAPI backend for the Devin Bursatil stock market application.

## Setup

```bash
poetry install
poetry run fastapi dev app/main.py --port 8000
```

## API Endpoints

- `GET /api/market/overview` - Market indices
- `GET /api/stock/{symbol}` - Stock data
- `POST /api/baskets` - Create investment basket
- `GET /api/baskets` - List baskets
- `GET /api/predict/{symbol}` - ML price prediction
- `POST /api/optimize` - Portfolio optimization
