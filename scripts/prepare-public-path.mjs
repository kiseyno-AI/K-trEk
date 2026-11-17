import { mkdir, rename } from 'node:fs/promises';

// Vite copies public/ at the asset root; the public trip lives under /ktravel.
const target = new URL('../dist/client/ktravel/', import.meta.url);
await mkdir(target, { recursive: true });
await rename(
  new URL('../dist/client/trip/', import.meta.url),
  new URL('trip/', target),
);
