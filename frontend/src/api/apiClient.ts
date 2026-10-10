import { AuditRequest, AuditResult } from '../types/contract';
import { MOCK_AUDIT_RESULT, MOCK_AUDITS_HISTORY } from './mockData';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// In-memory cache for fallback when backend is offline or running in mock mode
const mockAuditCache = new Map<string, AuditResult>();

// Initialize cache with default mock
mockAuditCache.set(MOCK_AUDIT_RESULT.id, MOCK_AUDIT_RESULT);

export async function createAudit(payload: AuditRequest): Promise<AuditResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/audits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }
    const result: AuditResult = await res.json();
    if (result && result.id) {
      mockAuditCache.set(result.id, result);
    }
    return result;
  } catch (error) {
    console.warn('[apiClient] Backend API call failed, using mock audit result fallback.', error);
    
    // Generate dynamic mock result with unique ID and current timestamps
    const generatedId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    
    // Adapt mock result based on user answer if desired or return rich mock result
    const mockResult: AuditResult = {
      ...MOCK_AUDIT_RESULT,
      id: generatedId,
      createdAt: now,
      updatedAt: now,
    };
    
    mockAuditCache.set(generatedId, mockResult);
    return mockResult;
  }
}

export async function getAuditById(id: string): Promise<AuditResult> {
  // Check local cache first
  if (mockAuditCache.has(id)) {
    const cached = mockAuditCache.get(id)!;
    // Simulate progression if cached audit is in polling pipeline
    if (cached.status !== 'completed' && cached.status !== 'failed') {
      const statusFlow: Record<string, 'queued' | 'extracting' | 'verifying' | 'analyzing' | 'completed'> = {
        queued: 'extracting',
        extracting: 'verifying',
        verifying: 'analyzing',
        analyzing: 'completed',
      };
      const nextStatus = statusFlow[cached.status] || 'completed';
      const updated: AuditResult = {
        ...cached,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      mockAuditCache.set(id, updated);
      return updated;
    }
    return cached;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/audits/${id}`);
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }
    const result: AuditResult = await res.json();
    mockAuditCache.set(id, result);
    return result;
  } catch (error) {
    console.warn(`[apiClient] Failed to fetch audit ${id}, returning mock data.`, error);
    const mockResult: AuditResult = {
      ...MOCK_AUDIT_RESULT,
      id,
    };
    mockAuditCache.set(id, mockResult);
    return mockResult;
  }
}

export async function rerunAudit(id: string): Promise<AuditResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/audits/${id}/rerun`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }
    const result: AuditResult = await res.json();
    mockAuditCache.set(id, result);
    return result;
  } catch (error) {
    console.warn(`[apiClient] rerunAudit failed, resetting mock state for audit ${id}`, error);
    const existing = mockAuditCache.get(id) || { ...MOCK_AUDIT_RESULT, id };
    const resetAudit: AuditResult = {
      ...existing,
      status: 'queued',
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
    mockAuditCache.set(id, resetAudit);
    return resetAudit;
  }
}

export async function listAudits(): Promise<AuditResult[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/audits`);
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    console.warn('[apiClient] Failed to fetch audits history, returning mock history.', error);
    const cached = Array.from(mockAuditCache.values());
    if (cached.length > 0) {
      return cached;
    }
    return MOCK_AUDITS_HISTORY;
  }
}
