import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { checkPublicAssets } from './check-public-assets.mjs';

export async function releasePublic(root, operations) {
  const dist = join(root, 'dist');
  await mkdir(join(root, '.wrangler'), { recursive: true });
  const backup = await mkdtemp(join(root, '.wrangler/public-release-'));
  let stopped = false,
    keepBackup = false;
  try {
    await cp(dist, join(backup, 'dist'), { recursive: true });
    await operations.stop();
    stopped = true;
    await operations.build();
    const previousClient = join(backup, 'dist/client');
    const manifest = JSON.parse(
      await readFile(join(previousClient, '.vite/manifest.json'), 'utf8'),
    );
    const files = new Set(
      Object.values(manifest).flatMap((entry) => [
        entry.file,
        ...(entry.css ?? []),
        ...(entry.assets ?? []),
      ]),
    );
    for (const file of files) {
      if (
        typeof file !== 'string' ||
        !file.startsWith('ktravel/_next/static/') ||
        file.includes('\\') ||
        file.split('/').includes('..')
      )
        continue;
      const target = join(dist, 'client', file);
      await mkdir(dirname(target), { recursive: true });
      // Only the previous fresh manifest survives, so older merged generations do not accumulate.
      await cp(join(previousClient, file), target, { force: false });
    }
    await operations.start();
    await operations.check();
  } catch (error) {
    if (!stopped) throw error;
    try {
      try {
        await operations.stop();
      } catch {
        /* It may still be stopped after a failed build. */
      }
      await rm(dist, { recursive: true, force: true });
      await cp(join(backup, 'dist'), dist, { recursive: true });
      await operations.start();
    } catch (recoveryError) {
      keepBackup = true;
      throw new AggregateError(
        [error, recoveryError],
        `Public release and recovery failed; previous build retained at ${backup}`,
      );
    }
    throw new Error('Public release failed; previous build restored', {
      cause: error,
    });
  } finally {
    if (!keepBackup) await rm(backup, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.platform !== 'darwin')
    throw new Error(
      'This public release uses the existing macOS launchd service',
    );
  const root = fileURLToPath(new URL('../', import.meta.url));
  const domain = `gui/${process.getuid()}`;
  const service = `${domain}/com.kiseyno.ktravel`;
  const plist = join(
    homedir(),
    'Library/LaunchAgents/com.kiseyno.ktravel.plist',
  );
  const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
      cwd: root,
      stdio: 'inherit',
      ...options,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`${command} failed with status ${result.status}`);
  };
  await releasePublic(root, {
    stop: async () =>
      run('launchctl', ['bootout', service], { stdio: 'ignore' }),
    build: async () => run('npm', ['run', 'build:public']),
    start: async () => {
      let loaded = false;
      for (let i = 0; i < 40; i += 1) {
        if (
          spawnSync('launchctl', ['bootstrap', domain, plist], {
            stdio: 'ignore',
          }).status === 0
        ) {
          loaded = true;
          break;
        }
        await delay(250);
      }
      if (!loaded) throw new Error('Unable to load the public trip service');
      for (let i = 0; i < 40; i += 1) {
        try {
          const response = await fetch('http://127.0.0.1:4330/ktravel', {
            signal: AbortSignal.timeout(1000),
          });
          await response.body?.cancel();
          if (response.status === 200) return;
        } catch {
          /* Wait for the new Worker to listen. */
        }
        await delay(250);
      }
      throw new Error('Public trip service did not become ready');
    },
    check: async () => {
      for (const base of [
        'http://127.0.0.1:4330/ktravel',
        'https://shawnai.win/ktravel',
      ]) {
        const result = await checkPublicAssets(base);
        console.log(`${result.origin}: ${result.assets} CSS/JS assets passed`);
      }
    },
  });
  console.log('Public trip released with matching server and assets');
}
