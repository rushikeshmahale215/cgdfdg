import asyncio
import os
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from elexon import (
    fetch_actuals,
    fetch_forecasts_range,
    latest_before_cutoff,
    latest_before_daily_cutoff,
)
from metrics import compute

MIN_DATE, MAX_DATE = date(2026, 1, 1), date(2026, 1, 31)


async def warm_cache():
    """Prefetch all of January in the background so the first user request is fast."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            await asyncio.gather(
                fetch_forecasts_range(
                    client,
                    datetime(2025, 12, 28, tzinfo=timezone.utc),
                    datetime(2026, 1, 31, tzinfo=timezone.utc),
                ),
                fetch_actuals(client, MIN_DATE, MAX_DATE),
            )
    except Exception:
        pass  # warm-up is best effort; requests will fetch on demand


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(warm_cache())
    yield
    task.cancel()


app = FastAPI(title="Wind Forecast Desk", lifespan=lifespan)

# Comma-separated list of allowed frontend origins; "*" for local development
_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(CORSMiddleware, allow_origins=["https://cgdfdg-2.onrender.com"],allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=["GET"])



def _cutoff(delivery: date, hour: int) -> datetime:
    # January is GMT, so UTC equals UK local time
    return datetime.combine(delivery - timedelta(days=1), time(hour), tzinfo=timezone.utc)


def _check_range(start: date, end: date):
    if start > end:
        raise HTTPException(400, "start must be on or before end")
    if start < MIN_DATE or end > MAX_DATE:
        raise HTTPException(400, "Dates must fall within January 2026")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/forecast")
async def forecast(
    delivery: date = Query(..., alias="date"),
    cutoff_hour: int = Query(9, ge=0, le=23),
):
    _check_range(delivery, delivery)
    cutoff = _cutoff(delivery, cutoff_hour)

    async with httpx.AsyncClient(timeout=60) as client:
        fc_rows, actuals = await asyncio.gather(
            fetch_forecasts_range(client, cutoff - timedelta(days=3), cutoff),
            fetch_actuals(client, delivery, delivery),
        )

    latest = latest_before_cutoff(fc_rows, cutoff)
    day_start = datetime.combine(delivery, time(0), tzinfo=timezone.utc)

    points = []
    for i in range(48):
        st = day_start + timedelta(minutes=30 * i)
        gen, pub = latest.get(st, (None, None))
        points.append({
            "startTime": st.isoformat(),
            "forecast": gen,
            "publishTime": pub.isoformat() if pub else None,
            "actual": actuals.get(st),
        })
    return {"delivery_date": delivery.isoformat(), "cutoff_utc": cutoff.isoformat(), "points": points}


@app.get("/api/accuracy")
async def accuracy(
    start: date,
    end: date,
    cutoff_hour: int = Query(9, ge=0, le=23),
):
    _check_range(start, end)

    async with httpx.AsyncClient(timeout=60) as client:
        fc_rows, actuals = await asyncio.gather(
            fetch_forecasts_range(
                client,
                _cutoff(start, cutoff_hour) - timedelta(days=3),
                _cutoff(end, cutoff_hour),
            ),
            fetch_actuals(client, start, end),
        )

    latest = latest_before_daily_cutoff(fc_rows, cutoff_hour, start, end)

    # score only half-hours where both a pre-cutoff forecast and an actual exist
    pairs = [
        (st, actuals[st], gen)
        for st, (gen, _pub) in sorted(latest.items())
        if st in actuals and gen is not None and actuals[st] is not None
    ]
    return compute(pairs)
