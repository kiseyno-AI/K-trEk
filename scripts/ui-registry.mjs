#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  readFile,
  writeFile,
  readdir,
  realpath,
  stat,
  lstat,
  mkdir,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const REPORT = 'docs/UI_COMPONENTS.md';
const EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.svelte',
  '.html',
  '.css',
  '.scss',
  '.svg',
  '.swift',
  '.storyboard',
  '.xib',
  '.kt',
  '.dart',
  '.xml',
  '.xaml',
];
const OMIT = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'vendor',
  'Pods',
  '.git',
  '.next',
  '.gradle',
]);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const ids = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const refs = (component) =>
  [
    component.implementation,
    ...(component.styles || []),
    ...(component.usages || []),
  ].filter(Boolean);

async function inside(root, file, kind = 'file') {
  if (
    !text(file) ||
    path.isAbsolute(file) ||
    file.includes('\\') ||
    file.split('/').some((part) => !part || part === '..' || part === '.')
  )
    throw new Error(`Unsafe project path: ${file}`);
  const absolute = path.resolve(root, file);
  const resolved = await realpath(absolute);
  if (!resolved.startsWith(root + path.sep))
    throw new Error(`Path escapes project: ${file}`);
  const info = await stat(resolved);
  if (kind === 'file' ? !info.isFile() : !info.isDirectory())
    throw new Error(`Expected ${kind}: ${file}`);
  return resolved;
}

async function load(root) {
  root = await realpath(root);
  const registry = JSON.parse(
    await readFile(await inside(root, 'ui-components.json'), 'utf8'),
  );
  const catalogue = JSON.parse(
    await readFile(await inside(root, registry.catalogue), 'utf8'),
  );
  return { root, registry, catalogue };
}

export async function scanSources({ root, registry }) {
  root = await realpath(root);
  const extensions = registry.sourceExtensions || EXTENSIONS;
  const files = new Set();
  async function walk(relative) {
    const directory = await inside(root, relative, 'directory');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (OMIT.has(entry.name)) continue;
      const file = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        if ((await stat(path.join(directory, entry.name))).isDirectory()) {
          await inside(root, file, 'directory');
          throw new Error(
            `Symlinked frontend directory requires an explicit non-symlink source tree: ${file}`,
          );
        }
        if (extensions.includes(path.extname(file))) {
          await inside(root, file);
          files.add(file);
        }
        continue;
      }
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && extensions.includes(path.extname(file)))
        files.add(file);
    }
  }
  for (const directory of registry.sourceRoots || []) await walk(directory);
  const result = [];
  for (const file of [...files].sort((a, b) => a.localeCompare(b))) {
    const components = (registry.components || [])
      .filter((component) => refs(component).some((ref) => ref.file === file))
      .map((component) => component.id);
    const prior = (registry.sources || []).find(
      (source) => source.file === file,
    );
    result.push({
      file,
      sha256: hash(await readFile(await inside(root, file))),
      components: ids(components),
      ...(!components.length && prior?.supportReason
        ? { supportReason: prior.supportReason }
        : {}),
    });
  }
  return result;
}

const cell = (value) =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
export function renderRegistry(registry, catalogue) {
  const components = [...registry.components].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const lines = [
    '# UI component registry',
    '',
    'Generated from `ui-components.json`; update the registry and run `node scripts/ui-registry.mjs render`.',
    '',
    `${components.length} component families · ${components.reduce((n, c) => n + (c.usages || []).length, 0)} registered usages · ${catalogue.components.length} free reference patterns · platform: ${cell(registry.platform)}.`,
    '',
    'A mapping marked **analogue** describes correspondence, not an installed upstream implementation. Custom components record why the catalogue does not fit.',
    '',
    '## Canonical implementations',
    '',
    '| Component | Patterns / exception | Canonical implementation | Dependencies | Checks |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const c of components)
    lines.push(
      `| ${cell(c.id)} — ${cell(c.label)} | ${c.patterns.length ? c.patterns.map((p) => `${cell(p.slug)} (${cell(p.relationship)})`).join(', ') : cell(c.customReason)} | ${cell(c.implementation.file)}: \`${cell(c.implementation.anchor)}\` | ${(c.uses || []).map(cell).join(', ') || '—'} | ${(c.checks || []).map(cell).join(', ')} |`,
    );
  lines.push(
    '',
    '## Usage and variant coverage',
    '',
    '| Component | Usage | Source anchor | Selector / native identifier | Variant | States |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const c of components)
    for (const u of c.usages || [])
      lines.push(
        `| ${cell(c.id)} | ${cell(u.id)} | ${cell(u.file)}: \`${cell(u.anchor)}\` | \`${cell(u.selector)}\` | ${cell(u.variant)} | ${(u.states || []).map(cell).join(', ')} |`,
      );
  lines.push(
    '',
    '## Shared styles',
    '',
    '| Component | Style source |',
    '| --- | --- |',
  );
  for (const c of components)
    for (const s of c.styles || [])
      lines.push(`| ${cell(c.id)} | ${cell(s.file)}: \`${cell(s.anchor)}\` |`);
  lines.push(
    '',
    '## Free catalogue coverage',
    '',
    `Reference revision: \`${cell(catalogue.upstream_commit || 'recorded snapshot')}\`. Unused patterns are available choices, not missing product features.`,
    '',
    '| Pattern | Status | Component families |',
    '| --- | --- | --- |',
  );
  for (const p of catalogue.components) {
    const users = components.filter((c) =>
      c.patterns.some((ref) => ref.slug === p.slug),
    );
    lines.push(
      `| [${cell(p.name)}](${p.url}) | ${users.length ? 'Mapped' : 'Available'} | ${users.map((c) => cell(c.id)).join(', ') || '—'} |`,
    );
  }
  lines.push(
    '',
    '## Reviewed source coverage',
    '',
    '| Source | Ownership / supporting role |',
    '| --- | --- |',
  );
  for (const s of [...registry.sources].sort((a, b) =>
    a.file.localeCompare(b.file),
  ))
    lines.push(
      `| ${cell(s.file)} | ${s.components.length ? s.components.map(cell).join(', ') : cell(s.supportReason)} |`,
    );
  lines.push(
    '',
    'Source fingerprints detect new, removed or edited frontend files requiring review. They do not prove semantic completeness or visual quality; inspect all affected variants and states before updating reviewed fingerprints.',
    '',
  );
  return lines.join('\n');
}

export function affectedComponents(registry, id) {
  if (!registry.components.some((component) => component.id === id))
    throw new Error(`Unknown component: ${id}`);
  const affected = new Set([id]);
  for (let changed = true; changed;) {
    changed = false;
    for (const c of registry.components)
      if (
        !affected.has(c.id) &&
        (c.uses || []).some((dependency) => affected.has(dependency))
      ) {
        affected.add(c.id);
        changed = true;
      }
  }
  return registry.components.filter((c) => affected.has(c.id));
}

export async function validateRegistry({
  root = process.cwd(),
  checkReport = true,
} = {}) {
  const errors = [];
  let data;
  try {
    data = await load(root);
  } catch (error) {
    return { errors: [error.message] };
  }
  const { registry, catalogue } = data;
  root = data.root;
  const fail = (message) => errors.push(message);
  try {
    if (registry.schemaVersion !== 1)
      fail('Unsupported registry schemaVersion');
    if (!text(registry.platform)) fail('Platform is required');
    if (!Array.isArray(registry.sourceRoots) || !registry.sourceRoots.length)
      fail('sourceRoots must identify the frontend source tree');
    if (!Array.isArray(registry.sources) || !Array.isArray(registry.components))
      throw new Error('sources and components must be arrays');
    if (!registry.components.length)
      fail(
        'Component inventory is empty; inspect the frontend and register its component families',
      );
    if (!Array.isArray(catalogue.components) || !catalogue.components.length)
      throw new Error('Free catalogue is empty');
    const patterns = new Set();
    for (const pattern of catalogue.components) {
      if (!text(pattern.slug) || patterns.has(pattern.slug))
        fail(`Duplicate or invalid catalogue pattern: ${pattern.slug}`);
      if (pattern.access !== 'free')
        fail(`Paid/restricted catalogue entry: ${pattern.slug}`);
      patterns.add(pattern.slug);
    }
    const componentIds = new Set();
    const canonical = new Set(),
      usages = new Set(),
      usageIds = new Set();
    const directOwners = new Map();
    const files = new Map();
    async function content(file) {
      if (!files.has(file))
        files.set(file, await readFile(await inside(root, file), 'utf8'));
      return files.get(file);
    }
    for (const c of registry.components) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id) || componentIds.has(c.id))
        fail(`Duplicate or invalid component id: ${c.id}`);
      componentIds.add(c.id);
    }
    for (const c of registry.components) {
      if (!text(c.label)) fail(`${c.id}: label is required`);
      if (!Array.isArray(c.patterns))
        throw new Error(`${c.id}: patterns must be an array`);
      if (!c.patterns.length && !text(c.customReason))
        fail(`${c.id}: custom components require customReason`);
      for (const p of c.patterns) {
        if (!patterns.has(p.slug))
          fail(`${c.id}: unknown free pattern ${p.slug}`);
        if (!['adapted', 'analogue'].includes(p.relationship))
          fail(`${c.id}: pattern relationship must be adapted or analogue`);
      }
      if (!c.implementation)
        throw new Error(`${c.id}: canonical implementation is required`);
      const key = `${c.implementation.file}\0${c.implementation.anchor}`;
      if (canonical.has(key))
        fail(
          `Duplicate canonical implementation: ${c.implementation.file} / ${c.implementation.anchor}`,
        );
      canonical.add(key);
      for (const ref of refs(c)) {
        if (!text(ref.anchor)) {
          fail(`${c.id}: a nonempty source anchor is required`);
          continue;
        }
        try {
          const body = await content(ref.file);
          const matches = body.split(ref.anchor).length - 1;
          if (matches !== 1)
            fail(
              `${c.id}: source anchor must occur once (${matches}): ${ref.file} / ${ref.anchor}`,
            );
          if (!directOwners.has(ref.file))
            directOwners.set(ref.file, new Set());
          directOwners.get(ref.file).add(c.id);
        } catch (error) {
          fail(`${c.id}: ${error.message}`);
        }
      }
      if (!Array.isArray(c.usages) || !c.usages.length)
        fail(`${c.id}: a nonempty usages array is required`);
      for (const u of c.usages || []) {
        const key = `${u.file}\0${u.anchor}`;
        if (usages.has(key))
          fail(`Duplicate usage ownership: ${u.file} / ${u.anchor}`);
        usages.add(key);
        if (!text(u.id) || usageIds.has(u.id))
          fail(`Duplicate or invalid usage id: ${u.id}`);
        usageIds.add(u.id);
        if (
          !text(u.selector) ||
          !text(u.variant) ||
          !Array.isArray(u.states) ||
          !u.states.length ||
          u.states.some((s) => !text(s))
        )
          fail(
            `${c.id}/${u.id}: selector/native identifier, variant and states are required`,
          );
        const literalClass =
          typeof u.anchor === 'string' &&
          u.anchor.match(/^(?:class|className)\s*:\s*(['"])([^'"\r\n]*)\1$/);
        if (
          literalClass &&
          typeof u.selector === 'string' &&
          /^\s*\.[A-Za-z_][\w-]*(?:\s*,\s*\.[A-Za-z_][\w-]*)*\s*$/.test(
            u.selector,
          )
        ) {
          const classes = new Set(literalClass[2].split(/\s+/));
          if (
            !u.selector
              .split(',')
              .some((selector) => classes.has(selector.trim().slice(1)))
          )
            fail(`${c.id}/${u.id}: selector/anchor class mismatch`);
        }
      }
      if (!Array.isArray(c.uses)) fail(`${c.id}: uses must be an array`);
      for (const dependency of c.uses || [])
        if (!componentIds.has(dependency))
          fail(`${c.id}: unknown component dependency ${dependency}`);
      if (!Array.isArray(c.checks) || !c.checks.length)
        fail(`${c.id}: verification check paths are required`);
      for (const file of c.checks || [])
        try {
          await inside(root, file);
        } catch (error) {
          fail(`${c.id}: ${error.message}`);
        }
    }
    const visited = new Set(),
      active = new Set();
    function visit(id) {
      if (active.has(id)) {
        fail(`Component dependency cycle at ${id}`);
        return;
      }
      if (visited.has(id)) return;
      active.add(id);
      for (const dependency of registry.components.find((c) => c.id === id)
        ?.uses || [])
        visit(dependency);
      active.delete(id);
      visited.add(id);
    }
    for (const id of componentIds) visit(id);
    const current = await scanSources({ root, registry });
    const recorded = new Map();
    for (const s of registry.sources) {
      if (recorded.has(s.file)) fail(`Duplicate reviewed source: ${s.file}`);
      recorded.set(s.file, s);
      const expected = ids(directOwners.get(s.file) || []);
      if (
        !Array.isArray(s.components) ||
        JSON.stringify(ids(s.components)) !== JSON.stringify(expected)
      )
        fail(
          `Source ownership mismatch: ${s.file}; expected ${expected.join(', ') || 'support-only'}`,
        );
      if (!expected.length && !text(s.supportReason))
        fail(`Supporting source needs supportReason: ${s.file}`);
      for (const id of s.components || [])
        if (!componentIds.has(id))
          fail(`Unknown source component ${id}: ${s.file}`);
    }
    const scanned = new Set(current.map((s) => s.file));
    for (const s of current) {
      const prior = recorded.get(s.file);
      if (!prior) fail(`Unregistered source: ${s.file}`);
      else if (prior.sha256 !== s.sha256)
        fail(`Unreviewed source change: ${s.file}`);
    }
    for (const file of recorded.keys())
      if (!scanned.has(file))
        fail(`Removed or out-of-scope reviewed source: ${file}`);
    for (const file of directOwners.keys())
      if (!recorded.has(file))
        fail(`Component source is not reviewed: ${file}`);
    const report = renderRegistry(registry, catalogue);
    if (checkReport) {
      try {
        if ((await readFile(await inside(root, REPORT), 'utf8')) !== report)
          fail(`Generated report is stale: ${REPORT}`);
      } catch (error) {
        fail(
          `Generated report missing or unsafe: ${REPORT} (${error.message})`,
        );
      }
    }
    return { errors, report, registry, catalogue, sources: current };
  } catch (error) {
    fail(error.message);
    return { errors, registry, catalogue };
  }
}

async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
async function ensureParent(root, file) {
  let directory = root;
  for (const part of path
    .dirname(file)
    .split('/')
    .filter((part) => part !== '.')) {
    const next = path.join(directory, part);
    if (await exists(next)) {
      const resolved = await realpath(next);
      if (!resolved.startsWith(root + path.sep))
        throw new Error(`Output escapes project: ${file}`);
      if (!(await stat(resolved)).isDirectory())
        throw new Error(`Output parent is not a directory: ${file}`);
      directory = resolved;
    } else {
      await mkdir(next);
      directory = next;
    }
  }
  return directory;
}
async function writeNew(root, file, body) {
  const parent = await ensureParent(root, file);
  await writeFile(path.join(parent, path.basename(file)), body, { flag: 'wx' });
}
export async function initializeRegistry({
  root,
  sourceRoots,
  platform = 'web',
  catalogueFile,
} = {}) {
  root = await realpath(root || process.cwd());
  if (!Array.isArray(sourceRoots) || !sourceRoots.length)
    throw new Error(
      'Pass at least one --source-root for the existing frontend',
    );
  for (const directory of sourceRoots)
    await inside(root, directory, 'directory');
  catalogueFile ||= path.resolve(
    path.dirname(SELF),
    '../references/catalogue.json',
  );
  const catalogue = JSON.parse(await readFile(catalogueFile, 'utf8'));
  if (
    !Array.isArray(catalogue.components) ||
    catalogue.components.some((c) => c.access !== 'free')
  )
    throw new Error('Initialization requires a free-only catalogue');
  const registry = {
    schemaVersion: 1,
    platform,
    catalogue: 'docs/ui/spaceui-free.json',
    sourceRoots,
    sourceExtensions: EXTENSIONS,
    sources: [],
    components: [],
  };
  const outputs = new Map([
    ['ui-components.json', JSON.stringify(registry, null, 2) + '\n'],
    ['scripts/ui-registry.mjs', await readFile(SELF, 'utf8')],
    ['docs/ui/spaceui-free.json', JSON.stringify(catalogue, null, 2) + '\n'],
    [REPORT, renderRegistry(registry, catalogue)],
  ]);
  for (const file of outputs.keys())
    if (await exists(path.join(root, file)))
      throw new Error(`Refusing to overwrite ${file}`);
  for (const file of outputs.keys()) {
    let ancestor = path.dirname(path.join(root, file));
    while (!(await exists(ancestor))) ancestor = path.dirname(ancestor);
    const resolved = await realpath(ancestor);
    if (resolved !== root && !resolved.startsWith(root + path.sep))
      throw new Error(`Output escapes project: ${file}`);
  }
  for (const [file, body] of outputs) await writeNew(root, file, body);
  return registry;
}

async function main(argv) {
  const command = argv.shift();
  let root = process.cwd(),
    platform = 'web',
    catalogueFile;
  const sourceRoots = [],
    positional = [];
  while (argv.length) {
    const arg = argv.shift();
    if (arg === '--root') root = argv.shift();
    else if (arg === '--source-root') sourceRoots.push(argv.shift());
    else if (arg === '--platform') platform = argv.shift();
    else if (arg === '--catalogue') catalogueFile = argv.shift();
    else positional.push(arg);
  }
  if (command === 'init') {
    await initializeRegistry({ root, sourceRoots, platform, catalogueFile });
    console.log(
      'Created pending inventory. Inspect sources, register components, review fingerprints, render the report and wire check into project verification.',
    );
    return;
  }
  if (!['check', 'scan', 'render', 'affected'].includes(command))
    throw new Error(
      'Usage: ui-registry.mjs <check|scan|render|affected ID|init> [--root PATH] [--source-root DIR] [--platform NAME] [--catalogue PATH]',
    );
  const data = await load(root);
  if (command === 'scan') {
    console.log(JSON.stringify(await scanSources(data), null, 2));
    return;
  }
  if (command === 'affected') {
    console.log(
      JSON.stringify(affectedComponents(data.registry, positional[0]), null, 2),
    );
    return;
  }
  if (command === 'render') {
    const destination = path.join(data.root, REPORT);
    await ensureParent(data.root, REPORT);
    if (await exists(destination)) {
      if ((await lstat(destination)).isSymbolicLink())
        throw new Error(`Refusing to overwrite report symlink: ${REPORT}`);
      await inside(data.root, REPORT);
    }
    await writeFile(destination, renderRegistry(data.registry, data.catalogue));
    console.log(`Updated ${REPORT}`);
    return;
  }
  const result = await validateRegistry({ root });
  if (result.errors.length) {
    console.error(result.errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      `UI registry passed: ${result.registry.components.length} families, ${result.sources.length} reviewed sources, ${result.catalogue.components.length} free patterns.`,
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
