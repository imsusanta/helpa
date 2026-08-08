import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-expect-error WebSocket polyfill for Node 20/22 runtime
  globalThis.WebSocket = WebSocket;
}
