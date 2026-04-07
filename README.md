# Devin Bursatil

Aplicacion fullstack de gestion de cestas de inversion virtuales con datos reales de mercado, predicciones ML y optimizacion de carteras.

## Caracteristicas

- **Dashboard de Mercados**: Indices principales (S&P 500, Dow Jones, NASDAQ, IBEX 35, Euro Stoxx 50) y acciones trending
- **Cestas Virtuales**: Crea cestas de inversion con 200 EUR virtuales, selecciona acciones del IBEX 35 o mercados internacionales
- **Prediccion ML**: Prediccion de precios a 30 dias usando regresion lineal sobre datos historicos
- **Optimizacion de Carteras**: Analisis Markowitz (frontera eficiente), comparacion de estrategias (equal weight, Markowitz, ML)
- **Alertas de Precio**: Configura alertas para cuando un valor supere o baje de un precio objetivo

## Tecnologias

### Backend
- **FastAPI** - API REST
- **yfinance** - Datos de mercado en tiempo real
- **scikit-learn** - Modelos de Machine Learning
- **scipy** - Optimizacion (Markowitz mean-variance)
- **numpy** - Calculos numericos

### Frontend
- **React + TypeScript** - UI con Vite
- **Tailwind CSS** - Estilos
- **shadcn/ui** - Componentes UI
- **Recharts** - Graficos (lineas, areas, barras, tarta)
- **Lucide** - Iconos

## Requisitos Previos

- Python 3.12+
- Node.js 18+
- Poetry (gestor de dependencias Python)

## Instalacion

### 1. Clonar el repositorio

```bash
git clone https://github.com/mcasrom/devin-bursatil.git
cd devin-bursatil
```

### 2. Configurar el Backend

```bash
cd devin-bursatil-backend
poetry install
```

### 3. Configurar el Frontend

```bash
cd devin-bursatil-frontend
npm install
```

### 4. Configurar variables de entorno

Crear archivo `.env` en `devin-bursatil-frontend/`:

```
VITE_API_URL=http://localhost:8000
```

## Ejecucion

### Iniciar el Backend

```bash
cd devin-bursatil-backend
poetry run fastapi dev app/main.py --port 8000
```

El backend estara disponible en `http://localhost:8000`.

### Iniciar el Frontend

```bash
cd devin-bursatil-frontend
npm run dev
```

El frontend estara disponible en `http://localhost:5173`.

## Uso

### 1. Dashboard
Al abrir la app, veras los indices principales del mercado y las acciones mas populares con su variacion diaria.

### 2. Crear una Cesta de Inversion
1. Ve a la pestana **Cestas**
2. Selecciona acciones del IBEX 35 o mercados internacionales
3. Elige una estrategia:
   - **Equal Weight**: Peso igual para cada accion
   - **Markowitz Optimized**: Optimizacion por frontera eficiente (maximiza Sharpe ratio)
   - **ML Weighted**: Pesos basados en predicciones de Machine Learning
4. Haz clic en **Crear Cesta** (200 EUR virtuales)
5. Consulta el rendimiento y la evolucion historica de cada cesta

### 3. Prediccion ML
1. Ve a la pestana **Prediccion**
2. Introduce el simbolo de una accion (ej: AAPL, SAN.MC)
3. Obtendras una prediccion a 30 dias con:
   - Grafico de prediccion
   - Cambio esperado (%)
   - Indicador de tendencia (alcista/bajista)
   - R² del modelo

### 4. Optimizacion de Carteras
1. Ve a la pestana **Optimizacion**
2. Selecciona al menos 2 acciones
3. Compara 3 estrategias: Equal Weight, Markowitz y ML
4. Visualiza la matriz de correlacion y el grafico de pesos optimos

### 5. Alertas de Precio
1. Ve a la pestana **Alertas**
2. Introduce simbolo, precio objetivo y condicion (por encima/por debajo)
3. Monitoriza el estado de tus alertas en tiempo real

## API Endpoints

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/healthz` | Health check |
| GET | `/api/stock/{symbol}` | Datos de una accion |
| GET | `/api/stock/{symbol}/history` | Historico de precios |
| GET | `/api/market/overview` | Indices principales |
| GET | `/api/market/trending` | Acciones trending |
| GET | `/api/portfolio` | Portfolio actual |
| POST | `/api/portfolio` | Anadir posicion |
| DELETE | `/api/portfolio/{id}` | Eliminar posicion |
| GET | `/api/alerts` | Listar alertas |
| POST | `/api/alerts` | Crear alerta |
| DELETE | `/api/alerts/{id}` | Eliminar alerta |
| GET | `/api/stocks/universe` | Universo de acciones (IBEX + International) |
| POST | `/api/baskets` | Crear cesta virtual |
| GET | `/api/baskets` | Listar cestas |
| GET | `/api/baskets/{id}` | Detalle de cesta |
| GET | `/api/baskets/{id}/history` | Historico de cesta |
| DELETE | `/api/baskets/{id}` | Eliminar cesta |
| GET | `/api/predict/{symbol}` | Prediccion ML |
| POST | `/api/optimize` | Optimizacion de cartera |

## Estructura del Proyecto

```
devin-bursatil/
├── devin-bursatil-backend/
│   ├── app/
│   │   ├── main.py          # API endpoints FastAPI
│   │   └── baskets.py       # ML, optimizacion, cestas virtuales
│   └── pyproject.toml       # Dependencias Python
├── devin-bursatil-frontend/
│   ├── src/
│   │   ├── App.tsx           # Componente principal React
│   │   ├── App.css           # Estilos
│   │   └── index.css         # Variables CSS / Tailwind
│   ├── package.json          # Dependencias Node
│   └── .env                  # Variables de entorno
└── README.md
```

## Acciones Disponibles

### IBEX 35
SAN.MC (Santander), BBVA.MC, ITX.MC (Inditex), TEF.MC (Telefonica), IBE.MC (Iberdrola), REP.MC (Repsol), AMS.MC (Amadeus), FER.MC (Ferrovial), ENG.MC (Enagas), GRF.MC (Grifols)

### Internacional
AAPL (Apple), MSFT (Microsoft), GOOGL (Alphabet), AMZN (Amazon), TSLA (Tesla), NVDA (NVIDIA), META, JPM (JPMorgan), V (Visa), JNJ (Johnson & Johnson)

## Licencia

MIT
