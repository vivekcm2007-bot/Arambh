import type { CaseWorkspace, EvidenceGraph, Modality, QueryAnswer } from '../shared/types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export async function fetchCases(): Promise<CaseWorkspace[]> {
  const data = await requestJson<{ cases: CaseWorkspace[] }>('/api/cases');
  return data.cases;
}

export async function createCase(payload: {
  title: string;
  domain: string;
  description: string;
}): Promise<CaseWorkspace> {
  const data = await requestJson<{ caseWorkspace: CaseWorkspace }>('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.caseWorkspace;
}

export async function resetCase(caseId: string): Promise<CaseWorkspace> {
  const data = await requestJson<{ caseWorkspace: CaseWorkspace }>(
    `/api/cases/${encodeURIComponent(caseId)}/reset`,
    { method: 'POST' }
  );
  return data.caseWorkspace;
}

export interface IngestItemPayload {
  title: string;
  filename: string;
  modality: Modality;
  mimeType: string;
  originAuthority: string;
  textContent?: string;
  binaryDataUrl?: string;
}

function estimateItemSize(item: IngestItemPayload): number {
  return (item.textContent?.length ?? 0) + (item.binaryDataUrl?.length ?? 0) + 512;
}

export async function ingestSources(
  caseId: string,
  items: IngestItemPayload[],
  onProgress?: (uploadedCount: number, totalCount: number) => void
): Promise<CaseWorkspace> {
  if (items.length === 0) {
    throw new Error('No evidence items to upload.');
  }

  const MAX_BATCH_ITEMS = 5;
  const MAX_BATCH_BYTES = 10 * 1024 * 1024;

  const batches: IngestItemPayload[][] = [];
  let currentBatch: IngestItemPayload[] = [];
  let currentBytes = 0;

  for (const item of items) {
    const itemSize = estimateItemSize(item);
    if (
      currentBatch.length > 0 &&
      (currentBatch.length >= MAX_BATCH_ITEMS || currentBytes + itemSize > MAX_BATCH_BYTES)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBytes = 0;
    }
    currentBatch.push(item);
    currentBytes += itemSize;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  let latestWorkspace: CaseWorkspace | null = null;
  let uploadedCount = 0;

  for (const batch of batches) {
    const data = await requestJson<{ caseWorkspace: CaseWorkspace }>(
      `/api/cases/${encodeURIComponent(caseId)}/ingest`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch }),
      }
    );
    latestWorkspace = data.caseWorkspace;
    uploadedCount += batch.length;
    onProgress?.(uploadedCount, items.length);
  }

  if (!latestWorkspace) {
    throw new Error('Ingestion failed to return updated workspace.');
  }
  return latestWorkspace;
}

export async function deleteSource(
  caseId: string,
  sourceId: string
): Promise<CaseWorkspace> {
  const data = await requestJson<{ caseWorkspace: CaseWorkspace }>(
    `/api/cases/${encodeURIComponent(caseId)}/sources/${encodeURIComponent(sourceId)}`,
    { method: 'DELETE' }
  );
  return data.caseWorkspace;
}

export async function analyzeCaseGraph(
  caseId: string
): Promise<{ graph: EvidenceGraph; caseWorkspace: CaseWorkspace }> {
  return requestJson<{ graph: EvidenceGraph; caseWorkspace: CaseWorkspace }>(
    `/api/cases/${encodeURIComponent(caseId)}/analyze`,
    { method: 'POST' }
  );
}

export async function queryCase(
  caseId: string,
  question: string
): Promise<{ answer: QueryAnswer; caseWorkspace: CaseWorkspace }> {
  return requestJson<{ answer: QueryAnswer; caseWorkspace: CaseWorkspace }>(
    `/api/cases/${encodeURIComponent(caseId)}/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }
  );
}
