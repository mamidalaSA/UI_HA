import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class RateLimiter:
    """In-memory sliding-window limiter for a single-process dev/demo deployment.
    Not shared across workers or instances — fine here since uvicorn runs with one worker."""

    def __init__(self, *, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def __call__(self, request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = self._hits[key]
        cutoff = now - self.window_seconds
        while hits and hits[0] < cutoff:
            hits.pop(0)
        if len(hits) >= self.max_requests:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests, try again shortly")
        hits.append(now)


login_rate_limit = RateLimiter(max_requests=10, window_seconds=60)
otp_rate_limit = RateLimiter(max_requests=5, window_seconds=60)
