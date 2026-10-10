"""
Thread-safe LRU cache for audit results.
"""

import hashlib
import json
import threading
from collections import OrderedDict
from typing import Optional

from model.config import settings
from model.schemas.request import AuditRequest
from model.schemas.result import AuditResult


class AuditCache:
    def __init__(self, maxsize: int = 256):
        self.maxsize = maxsize
        self._cache: OrderedDict[str, AuditResult] = OrderedDict()
        self._lock = threading.Lock()

    def _compute_key(self, request: AuditRequest) -> str:
        sources_str = "|".join(f"{s.id}:{s.text}" for s in request.sources)
        content = f"{request.question or ''}||{request.answer}||{sources_str}||{settings.MODEL_MODE}||{settings.LLM_PROVIDER}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def get(self, request: AuditRequest) -> Optional[AuditResult]:
        if not settings.ENABLE_AUDIT_CACHE:
            return None
        key = self._compute_key(request)
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
        return None

    def set(self, request: AuditRequest, result: AuditResult) -> None:
        if not settings.ENABLE_AUDIT_CACHE:
            return
        key = self._compute_key(request)
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = result
            if len(self._cache) > self.maxsize:
                self._cache.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


audit_cache = AuditCache(maxsize=settings.CACHE_MAX_SIZE)
