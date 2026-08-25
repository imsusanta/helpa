import type { Automation } from '@/types';

export interface AutomationLoadResult {
  automations?: Automation[];
  error?: string;
}

type AutomationFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export function createAutomationWorkspaceLoader(
  applyResult: (result: AutomationLoadResult) => void,
  fetcher: AutomationFetcher = fetch
) {
  let generation = 0;
  let controller: AbortController | null = null;

  async function load(): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const currentGeneration = ++generation;

    try {
      const response = await fetcher('/api/automations', {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.message || payload?.error || 'Failed to load automations'
        );
      }
      if (currentGeneration !== generation || controller.signal.aborted) return;
      applyResult({
        automations: (payload?.automations ?? []) as Automation[],
      });
    } catch (error) {
      if (currentGeneration !== generation || controller.signal.aborted) return;
      applyResult({
        error:
          error instanceof Error ? error.message : 'Failed to load automations',
      });
    }
  }

  function cancel(): void {
    generation += 1;
    controller?.abort();
    controller = null;
  }

  return { load, cancel };
}
