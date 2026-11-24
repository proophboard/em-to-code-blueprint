/**
 * prooph board REST client (see specs/bridge/api-contracts.md section 2).
 *
 * - Retries network errors, 429 and 5xx with backoff (default 250ms, 1s, 4s).
 * - No retry on other 4xx.
 * - Per-request timeout (default 15s).
 * - Error messages never contain the API key.
 */

import type { BoardElement, BoardElementType, DependencyGraph, DependencyNode, ProophClient } from './model.js';

export type { ProophClient } from './model.js';

export interface ProophClientOptions {
  timeout?: number;
  backoffDelays?: number[];
  maxRetries?: number;
}

const RELEVANT_TYPES: BoardElementType[] = ['command', 'event', 'information', 'automation'];

/** Removes API keys (`pb_...`) from any text. */
export function redact(text: string): string {
  return text.replace(/pb_[A-Za-z0-9_-]+/g, '[REDACTED]');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryable = (status: number) => status === 429 || status >= 500;

export function createProophClient(
  apiKey: string,
  endpoint: string,
  options: ProophClientOptions = {}
): ProophClient {
  const { timeout = 15000, backoffDelays = [250, 1000, 4000], maxRetries = 3 } = options;
  const base = endpoint.replace(/\/+$/, '');

  async function request(path: string, init: RequestInit = {}): Promise<any> {
    const url = `${base}${path}`;
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    };

    let lastError = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(backoffDelays[Math.min(attempt - 1, backoffDelays.length - 1)]);
      }

      let response: Response;
      try {
        response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeout) });
      } catch (error) {
        lastError = `Network error: ${error instanceof Error ? error.message : String(error)}`;
        continue;
      }

      if (response.ok) {
        return response.json();
      }

      const body = await response.json().catch(() => ({}));
      lastError = `HTTP ${response.status}${body?.error ? `: ${body.error}` : ''}`;

      if (!isRetryable(response.status)) {
        break;
      }
    }

    throw new Error(redact(`${init.method ?? 'GET'} ${path} failed: ${lastError}`));
  }

  const toNode = (n: any): DependencyNode => ({
    id: n.id,
    type: n.type,
    name: n.name,
    context: n.context || 'App',
    chapterId: n.chapterId,
    sliceId: n.sliceId,
    chapterName: n.chapterName
  });

  return {
    async getSliceElements(chapterId, sliceId) {
      const query = new URLSearchParams({ slice_ids: sliceId, structure_only: 'true' });
      const data = await request(`/chapters/${encodeURIComponent(chapterId)}?${query}`);

      const slice = (data.slices ?? []).find((s: any) => s.id === sliceId);
      if (!slice) {
        throw new Error(`Slice ${sliceId} not found in chapter ${chapterId}`);
      }

      const elements: BoardElement[] = (data.elements ?? [])
        .filter((e: any) => RELEVANT_TYPES.includes(e.type))
        .map((e: any) => ({
          id: e.id,
          type: e.type,
          name: e.name,
          description: e.description ?? '',
          details: e.details ?? '',
          icon: e.icon ?? '',
          laneId: e.laneId,
          sliceId: e.sliceId,
          index: e.index,
          comments: e.comments ?? [],
          context: e.context || 'App',
          chapterId,
          chapterName: data.name,
          sliceStatus: slice.status
        }));

      return { slice: { id: slice.id, chapterId, label: slice.label }, elements, chapterName: data.name };
    },

    async getDependencyGraph(chapterId, elementId) {
      const data = await request(
        `/chapters/${encodeURIComponent(chapterId)}/elements/${encodeURIComponent(elementId)}/dependency-graph`
      );
      const el = data.element ?? {};

      return {
        element: {
          id: el.id,
          type: el.type,
          name: el.name,
          description: el.description ?? '',
          details: el.details ?? '',
          icon: el.icon ?? '',
          laneId: el.laneId,
          sliceId: el.sliceId,
          index: el.index,
          comments: el.comments ?? [],
          context: el.context || 'App',
          chapterId: el.chapterId ?? chapterId,
          chapterName: el.chapterName,
          sliceStatus: el.sliceStatus
        },
        sources: (data.sources ?? []).map(toNode),
        targets: (data.targets ?? []).map(toNode)
      };
    },

    async addTaskComment(chapterId, elementId, text) {
      await request(
        `/chapters/${encodeURIComponent(chapterId)}/elements/${encodeURIComponent(elementId)}/comments`,
        { method: 'POST', body: JSON.stringify({ text, is_task: true }) }
      );
    }
  };
}
