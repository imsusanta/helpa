import { describe, expect, it, vi } from 'vitest';

import { createAutomationWorkspaceLoader } from './workspace-loader';

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function response(automations: Array<{ id: string }>) {
  return new Response(JSON.stringify({ automations }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('automation workspace loader', () => {
  it('makes a fresh no-store credentialed request for each workspace load', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([{ id: 'account-a' }]))
      .mockResolvedValueOnce(response([{ id: 'account-b' }]));
    const results: unknown[] = [];
    const loader = createAutomationWorkspaceLoader(
      (result) => results.push(result),
      fetcher
    );

    await loader.load();
    await loader.load();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/api/automations',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' })
    );
    expect(results).toHaveLength(2);
  });

  it('ignores a late response from the previous workspace', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const results: Array<{ automations?: Array<{ id: string }> }> = [];
    const loader = createAutomationWorkspaceLoader(
      (result) => results.push(result),
      fetcher
    );

    const oldLoad = loader.load();
    const newLoad = loader.load();
    second.resolve(response([{ id: 'new-workspace' }]));
    await newLoad;
    first.resolve(response([{ id: 'old-workspace' }]));
    await oldLoad;

    expect(results).toEqual([
      { automations: [expect.objectContaining({ id: 'new-workspace' })] },
    ]);
  });
});
