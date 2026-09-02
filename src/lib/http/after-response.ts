import { after } from 'next/server';

/**
 * Run work after the HTTP response is sent when Next.js request scope
 * is available. Falls back to a microtask so unit tests and non-request
 * callers still schedule the work without throwing.
 */
export function runAfterResponse(task: () => void | Promise<void>): void {
  try {
    after(task);
  } catch {
    void Promise.resolve().then(task);
  }
}
