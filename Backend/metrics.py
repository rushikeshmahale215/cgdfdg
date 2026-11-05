import math
from collections import defaultdict


def percentile(sorted_vals, q):
    if not sorted_vals:
        return None
    k = (len(sorted_vals) - 1) * q
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def summarize(errors):
    """errors = list of (actual - forecast) in MW."""
    n = len(errors)
    if n == 0:
        return {"mae": None, "rmse": None, "bias": None, "p90_abs_error": None, "n": 0}
    abs_e = sorted(abs(e) for e in errors)
    return {
        "mae": sum(abs_e) / n,
        "rmse": math.sqrt(sum(e * e for e in errors) / n),
        "bias": sum(errors) / n,
        "p90_abs_error": percentile(abs_e, 0.90),
        "n": n,
    }


def compute(pairs):
    """pairs = list of (startTime datetime, actual MW, forecast MW)."""
    errors = [a - f for _, a, f in pairs]

    by_hour, by_day = defaultdict(list), defaultdict(list)
    for st, a, f in pairs:
        by_hour[st.hour].append(a - f)
        by_day[st.date().isoformat()].append(a - f)

    def group(d, key):
        out = []
        for k in sorted(d):
            s = summarize(d[k])
            out.append({key: k, "mae": s["mae"], "bias": s["bias"]})
        return out

    return {
        "summary": summarize(errors),
        "by_hour": group(by_hour, "hour"),
        "by_day": group(by_day, "date"),
    }