# Backend: Wind Forecast Desk API

FastAPI service that fetches wind actuals and forecasts from Elexon, applies the day-ahead decision cutoff, and computes forecast-error metrics.

## Stack

- Python 3.11+
- FastAPI and Uvicorn
- httpx (async HTTP client)

## Files

| File | Purpose |
|---|---|
| `main.py` | App, routes, input validation (January 2026 only), CORS |
| `elexon.py` | Elexon client: chunked parallel fetches, retries with backoff, in-memory cache, no-hindsight forecast selection |
| `metrics.py` | MAE, RMSE, bias, P90 and grouping by hour and day (pure functions, no I/O) |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Container build |
| `tests/` | Unit tests |

## Run

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs

## API

### `GET /api/health`
Returns `{"status": "ok"}`.

### `GET /api/forecast`

| Param | Description |
|---|---|
| `date` | Delivery day, `YYYY-MM-DD`, within January 2026 |
| `cutoff_hour` | Hour (0-23, UTC) on D-1 when the decision is made. Default 9 |

Returns a 48-slot day grid:
```json
{
  "delivery_date": "2026-01-15",
  "cutoff_utc": "2026-01-14T09:00:00+00:00",
  "points": [
    {"startTime": "...", "forecast": 0, "publishTime": "...", "actual": 0}
  ]
}
```
`forecast` and `publishTime` are `null` if no forecast was published before the cutoff. `actual` is `null` if not available.

### `GET /api/accuracy`

| Param | Description |
|---|---|
| `start`, `end` | Delivery-day range, within January 2026 |
| `cutoff_hour` | As above. Default 9 |

Returns:
```json
{
  "summary": {"mae": 0, "rmse": 0, "bias": 0, "p90_abs_error": 0, "n": 0},
  "by_hour": [{"hour": 0, "mae": 0, "bias": 0}],
  "by_day":  [{"date": "2026-01-01", "mae": 0, "bias": 0}]
}
```

Errors: `400` if the range is invalid or outside January 2026.

## Data source

Elexon Insights API, base URL `https://data.elexon.co.uk/bmrs/api/v1`, no key required.

| Dataset | Endpoint | Params used |
|---|---|---|
| FUELHH (actuals) | `/datasets/FUELHH/stream` | `settlementDateFrom`, `settlementDateTo`, `fuelType=WIND` |
| WINDFOR (forecasts) | `/datasets/WINDFOR/stream` | `publishDateTimeFrom`, `publishDateTimeTo` |

Quick checks from a terminal:
```bash
curl "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream?settlementDateFrom=2026-01-15&settlementDateTo=2026-01-15&fuelType=WIND" | head -c 600

curl -s "https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream?publishDateTimeFrom=2026-01-13T00:00Z&publishDateTimeTo=2026-01-14T09:00Z" | python -c "import sys,json; d=json.load(sys.stdin); d=d['data'] if isinstance(d,dict) else d; print(len(d)); print(sorted({r['startTime'][14:16] for r in d}))"
```
The second command prints the minutes found in WINDFOR `startTime`: `['00']` means hourly forecasts, `['00', '30']` means half-hourly.

## Design notes

- **No hindsight.** For delivery day D the cutoff is D-1 at `cutoff_hour` UTC. Forecasts with `publishTime` after the cutoff are ignored, and for each `startTime` the forecast with the latest `publishTime` up to the cutoff is used (`latest_before_cutoff`, and `latest_before_daily_cutoff` for ranges).
- **Sign convention.** error = actual − forecast.
- **Scoring.** Only target times with both a pre-cutoff forecast and an actual are scored. Nothing is imputed.
- **Performance.** Actuals are fetched in 7-day chunks. Forecasts are fetched in 1-day publish windows, 5 at a time (semaphore). Failed requests are retried up to 3 times with backoff (1s, 2s, 4s).
- **Caching.** Responses are cached in memory for the process lifetime. This is safe because January 2026 is historical. A restart refetches data.
- **Time zone.** January is GMT, so UTC equals UK local time.
- **No database.** The data volume is small and sourced from a free public API.

## Tests

```bash
pip install pytest
pytest
```
<<FILL: list what your tests cover once written, e.g. metrics on a known error list, and cutoff selection ignoring later forecasts.>>

## Environment

No environment variables are required. CORS currently allows all origins, which should be restricted to the frontend URL in production.

## Attribution

Contains BMRS data © Elexon Limited copyright and database right.