import asyncio
from datetime import date, datetime, time, timedelta, timezone

import httpx

BASE = "https://data.elexon.co.uk/bmrs/api/v1"

# January 2026 is historical, so caching responses for the process lifetime is safe.
_cache: dict = {}


def parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)


def iso_min(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def _rows(payload):
    # stream endpoints return a bare list; be tolerant of {"data": [...]}
    return payload["data"] if isinstance(payload, dict) else payload


async def _get_cached(client: httpx.AsyncClient, path: str, params: dict) -> list:
    key = (path, tuple(sorted(params.items())))
    if key in _cache:
        return _cache[key]
    last_err = None
    for attempt in range(3):
        try:
            r = await client.get(f"{BASE}{path}", params=params)
            r.raise_for_status()
            rows = _rows(r.json())
            _cache[key] = rows
            return rows
        except httpx.HTTPError as e:
            last_err = e
            await asyncio.sleep(2 ** attempt)
    raise last_err


async def fetch_actuals(client: httpx.AsyncClient, start: date, end: date) -> dict:
    """{startTime(datetime): wind MW} from FUELHH, fetched in 7-day chunks."""
    chunks, d = [], start
    while d <= end:
        e = min(d + timedelta(days=6), end)
        chunks.append((d, e))
        d = e + timedelta(days=1)

    results = await asyncio.gather(*[
        _get_cached(client, "/datasets/FUELHH/stream", {
            "settlementDateFrom": a.isoformat(),
            "settlementDateTo": b.isoformat(),
            "fuelType": "WIND",
        })
        for a, b in chunks
    ])
    return {
        parse_ts(x["startTime"]): x["generation"]
        for rows in results
        for x in rows
        if x.get("fuelType", "WIND") == "WIND"
    }


async def fetch_forecasts(client: httpx.AsyncClient, pub_from: datetime, pub_to: datetime) -> list:
    """All WINDFOR rows published in [pub_from, pub_to]."""
    return await _get_cached(client, "/datasets/WINDFOR/stream", {
        "publishDateTimeFrom": iso_min(pub_from),
        "publishDateTimeTo": iso_min(pub_to),
    })


async def fetch_forecasts_range(client: httpx.AsyncClient, pub_from: datetime, pub_to: datetime) -> list:
    """WINDFOR rows published in the range, fetched in 1-day windows aligned to UTC midnight.

    Alignment makes cache keys independent of the cutoff hour. Rows published after the
    cutoff are fetched too, but latest_before_cutoff() discards them.
    """
    sem = asyncio.Semaphore(5)

    async def one(a, b):
        async with sem:
            return await fetch_forecasts(client, a, b)

    t = pub_from.replace(hour=0, minute=0, second=0, microsecond=0)
    chunks = []
    while t < pub_to:
        chunks.append((t, t + timedelta(days=1)))
        t += timedelta(days=1)

    results = await asyncio.gather(*[one(a, b) for a, b in chunks])
    return [row for rows in results for row in rows]


def latest_before_cutoff(rows: list, cutoff: datetime) -> dict:
    """{startTime: (generation, publishTime)} keeping the latest publishTime <= cutoff."""
    best = {}
    for x in rows:
        pub = parse_ts(x["publishTime"])
        if pub > cutoff:
            continue  # not known at decision time -> hindsight
        st = parse_ts(x["startTime"])
        if st not in best or pub > best[st][1]:
            best[st] = (x["generation"], pub)
    return best


def latest_before_daily_cutoff(rows: list, cutoff_hour: int, start: date, end: date) -> dict:
    """Like latest_before_cutoff, but each delivery day D uses its own cutoff: D-1 at cutoff_hour UTC."""
    best = {}
    for x in rows:
        st = parse_ts(x["startTime"])
        d = st.date()
        if d < start or d > end:
            continue
        cutoff = datetime.combine(d - timedelta(days=1), time(cutoff_hour), tzinfo=timezone.utc)
        pub = parse_ts(x["publishTime"])
        if pub > cutoff:
            continue
        if st not in best or pub > best[st][1]:
            best[st] = (x["generation"], pub)
    return best