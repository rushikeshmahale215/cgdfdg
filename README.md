
# Wind Forecast Desk: UK Day-Ahead Wind Forecast and Accuracy Portal

A web app for a UK energy utility's day-ahead power buying team. It answers two questions:

1. **What is the latest wind forecast available at decision time?**
2. **How accurate have those forecasts been, in MW?** This lets buyers size a safety margin for the power they buy beyond wind.

Data comes only from Elexon's national wind datasets (actuals and forecasts), for purchase decisions made in **January 2026**.

## Links

| Item | URL |
|---|---|
| Live app | <<FILL: deployed Vercel/Heroku URL>> |
| Video demo (unlisted YouTube) | <<FILL: YouTube URL>> |
| Backend API docs (when running) | `<backend-url>/docs` |

## Use of AI tools

AI tools were used in building this project:

- **Claude (Anthropic)** to generate React components, Python API integration, calculations and charts.
- All generated code was run, tested and reviewed by me before submission. The data checks and design decisions described below were verified against the live Elexon API.


## Business context

The utility must buy electricity in the UK day-ahead market one day before delivery. Wind output is weather-dependent, so the amount that must be bought from other sources (e.g. thermal plants) depends on a wind forecast. This portal shows that forecast and measures how reliable it has been.

## Data

All data comes from the Elexon Insights (BMRS) API. No API key is needed.

- Base URL: `https://data.elexon.co.uk/bmrs/api/v1`

| Dataset | Meaning | Endpoint | Fields used |
|---|---|---|---|
| **FUELHH** | Actual half-hourly generation by fuel type. We filter `fuelType = WIND`. | `/datasets/FUELHH/stream` | `startTime`, `generation` (MW) |
| **WINDFOR** | Forecast wind generation, issued many times per target time. | `/datasets/WINDFOR/stream` | `startTime`, `publishTime`, `generation` (MW) |

Scope:
- National (GB) wind only. No demand, prices or other fuels.
- Purchase decisions for delivery days **1–31 January 2026**.
- All times are **UTC**, which equals UK local time in January (GMT).

Data notes:
FILL: after running the check in backend/README.md, state whether WINDFOR `startTime` values fall on the hour only (hourly) or on both :00 and :30 (half-hourly). If hourly, say that accuracy is scored only where a real forecast exists and no values were invented.>>
- Elexon requires attribution: *Contains BMRS data © Elexon Limited copyright and database right.* This appears in the app footer.

## Key analytical decision: no hindsight

WINDFOR contains many forecasts for the same target time, each with a different `publishTime`. For delivery day D, the buyer decides on D-1 and can only use forecasts published **before the cutoff**.

For each target time the app keeps only forecasts with `publishTime <= cutoff` and picks the one with the **latest** `publishTime`. Using a later forecast would make accuracy look better than what the buyer actually had.

- Default cutoff: **09:00 UTC on D-1** (an assumption, close to the day-ahead auction gate closure). It is adjustable in the UI.
- Error is defined as **actual − forecast**. Positive means wind exceeded the forecast (over-bought). Negative means a shortfall (under-bought).

## Metrics

| Metric | Definition |
|---|---|
| MAE | mean of abs(actual − forecast) |
| RMSE | square root of the mean squared error |
| Bias | mean of (actual − forecast) |
| P90 abs error | 90th percentile of abs(error) |
| n | number of scored forecast points (where both a pre-cutoff forecast and an actual exist) |

The same metrics are reported by hour of day and by delivery day.

## January 2026 results (cutoff 09:00 UTC on D-1)

FILL: copy from the Accuracy page with range 2026-01-01 to 2026-01-31 and cutoff 09:00.

| Metric | Value |
|---|---|
| MAE | <<FILL>> MW |
| RMSE | <<FILL>> MW |
| Bias | <<FILL>> MW |
| P90 abs error | <<FILL>> MW |
| n | <<FILL>> |

Hardest hour of day: <<FILL>>. Hardest delivery day: <<FILL>>.

How to read this: a buffer near the P90 error would have covered 90% of scored periods. This is a planning heuristic, not a cost-optimised hedge.

## Architecture

```
Browser (React + Vite + Recharts)
        | GET /api/forecast, /api/accuracy
        v
FastAPI backend (Python)
   elexon.py   fetch, retry, cache, no-hindsight selection
   metrics.py  MAE / RMSE / bias / P90, by hour and day
   main.py     routes, validation, CORS
        |
        v
Elexon Insights API (FUELHH, WINDFOR)
```

There is no database. The data is small, historical and freely available, so an in-memory cache is enough.

## Repository structure

```
.
├── README.md               this file
├── docker-compose.yml      runs backend and frontend together
├── backend/
│   ├── README.md           backend details and API reference
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py             FastAPI app and routes
│   ├── elexon.py           Elexon client and cutoff logic
│   ├── metrics.py          error metrics
│   └── tests/              unit tests
└── frontend/
    ├── README.md           frontend details
    ├── Dockerfile
    ├── package.json
    ├── index.html
    └── src/
        ├── main.jsx        entry point and router
        ├── App.jsx         layout, navigation, footer
        ├── api.js          backend client
        ├── index.css       global styles
        └── pages/
            ├── Overview.jsx
            ├── ForecastPage.jsx
            └── AccuracyPage.jsx
```

## How to start the application

### Option A: Docker (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000 (docs at http://localhost:8000/docs)

### Option B: run locally without Docker

Backend (Python 3.11+):
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend (Node 18+), in a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

The first request for a full month can take several seconds because it fetches from Elexon. Later requests are served from the cache.

## Deployment

- Frontend: <<FILL: Vercel>>
- Backend: <<FILL: Heroku / other>>
- The frontend reads the backend address from `VITE_API_URL`.

## Limitations

- National wind only, January 2026 only, no demand or price data.
- The 09:00 UTC cutoff is an assumption. Change it in the UI if the client's decision time differs.
- The cache is in memory, so a cold start refetches data from Elexon.

## Possible next steps

- Compare accuracy across several cutoff times in one view.
- Analyse error by forecast horizon (how many hours ahead the forecast was issued).
- Add demand data to turn the wind error into an actual purchase volume.

# cgdfdg

