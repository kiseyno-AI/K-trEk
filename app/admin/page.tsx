import { headers } from 'next/headers';
import Link from 'next/link';
import { canEditActivities } from '../../lib/trip-admin';
import { listActivityRecords } from '../../lib/activity-store';
import { ActivityEditor } from './activity-editor';
import styles from './admin.module.css';

export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  const incoming = await headers();
  const request = {
    url: `https://${incoming.get('host') || 'invalid'}/admin`,
    headers: incoming,
  };
  const allowed = await canEditActivities(request);
  if (!allowed)
    return (
      <main className={styles.shell}>
        <section className={styles.denied}>
          <h1>Editor access required</h1>
          <p>Sign in as Shawn or Sun to edit the trip.</p>
          <Link href="/" prefetch={false}>
            Back to the trip
          </Link>
        </section>
      </main>
    );
  let records = null;
  try {
    records = await listActivityRecords();
  } catch {
    /* The setup state below keeps this route usable before migration. */
  }
  if (!records) {
    return (
      <main className={styles.shell}>
        <section className={styles.denied}>
          <h1>Activity database is not ready</h1>
          <p>Run the local database setup, then reload this page.</p>
          <code>node --experimental-strip-types scripts/db-setup.mjs</code>
          <p>
            <Link href="/" prefetch={false}>
              Back to the trip
            </Link>
          </p>
        </section>
      </main>
    );
  }
  return <ActivityEditor initialRecords={records} />;
}
