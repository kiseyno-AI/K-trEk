import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--database' || !args[1])
  throw new Error(
    'Usage: node --experimental-strip-types scripts/provision-trip-admins.mjs --database <local SQLite path>',
  );
const databasePath = resolve(args[1]);
const info = await lstat(databasePath);
if (!info.isFile() || info.isSymbolicLink())
  throw new Error('Use the existing regular local database file.');
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
try {
  let created = 0;
  for (const name of ['Shawn', 'Sun']) {
    const key = name.toLowerCase();
    const existing = db
      .prepare('SELECT role FROM trip_users WHERE name_key=?')
      .get(key);
    if (existing) {
      if (existing.role !== 'admin')
        throw new Error(
          'A reserved account has an unexpected role. No account was changed.',
        );
      continue;
    }
    db.prepare(
      "INSERT INTO trip_users(id,name,name_key,password_hash,role,created_at) VALUES(?,?,?,'','admin',?)",
    ).run(randomUUID(), name, key, Date.now());
    created += 1;
  }
  db.exec('COMMIT');
  console.log(
    `Prepared ${created} new administrator account(s) for first password setup. Existing passwords and account IDs were preserved; no credential files were created.`,
  );
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
