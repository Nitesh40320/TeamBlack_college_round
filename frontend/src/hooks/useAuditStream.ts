import { useEffect, useState, useRef, useCallback } from 'react';
import { AuditResult } from '../types/contract';
import { getAuditById } from '../api/apiClient';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function useAuditStream(auditId: string | undefined) {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pollingTimerRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchFullAudit = useCallback(async (id: string) => {
    try {
      const data = await getAuditById(id);
      setAudit(data);
      setError(null);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit details');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startPolling = useCallback((id: string) => {
    if (pollingTimerRef.current) return;
    setIsStreaming(false);

    pollingTimerRef.current = setInterval(async () => {
      const updated = await fetchFullAudit(id);
      if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      }
    }, 2000);
  }, [fetchFullAudit]);

  useEffect(() => {
    if (!auditId) return;

    setLoading(true);
    let isCancelled = false;

    // First fetch current snapshot
    fetchFullAudit(auditId).then((initialData) => {
      if (isCancelled || !initialData) return;

      if (initialData.status === 'completed' || initialData.status === 'failed') {
        return;
      }

      // Try connecting to SSE stream endpoint
      try {
        const sseUrl = `${BASE_URL}/api/audits/${auditId}/stream`;
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;
        setIsStreaming(true);

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setAudit((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                status: data.status || prev.status,
                progress: data.progress || (prev as any).progress,
                error: data.error || prev.error,
              };
            });

            if (data.status === 'completed' || data.status === 'failed') {
              es.close();
              setIsStreaming(false);
              // Fetch final complete data
              fetchFullAudit(auditId);
            }
          } catch (e) {
            console.error('[SSE] Failed to parse message', e);
          }
        };

        es.onerror = () => {
          console.warn('[SSE] SSE connection closed/errored, falling back to polling');
          es.close();
          setIsStreaming(false);
          startPolling(auditId);
        };
      } catch (e) {
        console.warn('[SSE] EventSource init failed, using polling fallback', e);
        startPolling(auditId);
      }
    });

    return () => {
      isCancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [auditId, fetchFullAudit, startPolling]);

  return {
    audit,
    loading,
    isStreaming,
    error,
    refetch: () => auditId && fetchFullAudit(auditId),
  };
}
