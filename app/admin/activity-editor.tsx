'use client';

import { sitePath } from '../../lib/site-path';

import { useEffect, useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Plus, Save } from 'lucide-react';
import {
  ACTIVITY_COLUMNS,
  ACTIVITY_FIELD_GROUPS,
  URL_LIST_FIELDS,
  emptyActivity,
  type ActivityInput,
  type ActivityRecord,
} from '../../lib/activities';
import styles from './admin.module.css';

const editable = (record: ActivityInput): ActivityInput =>
  Object.fromEntries(
    ACTIVITY_COLUMNS.map((key) => [key, record[key]]),
  ) as ActivityInput;

export function ActivityEditor({
  initialRecords,
}: {
  initialRecords: ActivityRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [existingId, setExistingId] = useState<string | null>(
    initialRecords[0]?.id || null,
  );
  const initial = initialRecords[0]
    ? editable(initialRecords[0])
    : { ...emptyActivity };
  const [form, setForm] = useState<ActivityInput>(initial);
  const [savedState, setSavedState] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== savedState;
  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);
  const select = (record?: ActivityRecord) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const next = record ? editable(record) : { ...emptyActivity };
    setForm(next);
    setSavedState(JSON.stringify(next));
    setExistingId(record?.id || null);
    setNotice('');
    setError('');
  };
  const setField = (
    key: keyof ActivityInput,
    value: ActivityInput[keyof ActivityInput],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const input = { ...form };
    for (const key of URL_LIST_FIELDS)
      input[key] = input[key].map((value) => value.trim()).filter(Boolean);
    try {
      const response = await fetch(
        sitePath(
          existingId
            ? `/api/activities/${encodeURIComponent(existingId)}`
            : '/api/activities',
        ),
        {
          method: existingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      const result = (await response.json()) as {
        activity?: ActivityRecord;
        error?: string;
      };
      if (!response.ok || !result.activity)
        throw new Error(result.error || 'The card could not be saved.');
      const record = result.activity;
      setRecords((current) =>
        current.some((item) => item.id === record.id)
          ? current.map((item) => (item.id === record.id ? record : item))
          : [...current, record],
      );
      const next = editable(record);
      setForm(next);
      setSavedState(JSON.stringify(next));
      setExistingId(record.id);
      setNotice(
        record.published
          ? 'Saved to the database. The trip page will show this card when opened or refreshed.'
          : 'Saved as hidden. This card is not shown on the trip page.',
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'The card could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link
            href="/"
            prefetch={false}
            onClick={(event) => {
              if (dirty && !window.confirm('Discard unsaved changes?'))
                event.preventDefault();
            }}
          >
            <ArrowLeft size={17} /> Back to the trip
          </Link>
          <div>
            <h1>Activity editor</h1>
            <p>
              Keep confirmed facts, planning suggestions and missing information
              separate.
            </p>
          </div>
        </header>
        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Activity records">
            <div className={styles.listHeading}>
              <h2>
                Cards <span>{records.length}</span>
              </h2>
              <button type="button" onClick={() => select()} disabled={saving}>
                <Plus size={16} /> New
              </button>
            </div>
            <div className={styles.records}>
              {records.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  aria-pressed={existingId === record.id}
                  onClick={() => select(record)}
                  disabled={saving}
                >
                  <strong>{record.name_en}</strong>
                  <span>{record.name_ko}</span>
                  <small>
                    {record.id}
                    {record.is_illustrative ? ' · Sample' : ''}
                    {record.published ? '' : ' · Hidden'}
                  </small>
                </button>
              ))}
            </div>
            <p className={styles.help}>
              Blank means unknown. A booking link does not confirm a date, and a
              photo reference does not grant reuse rights.
            </p>
          </aside>
          <form
            onSubmit={(event) => {
              void save(event);
            }}
            className={styles.form}
          >
            <div className={styles.toolbar}>
              <div>
                <h2>{existingId ? form.name_en : 'New activity'}</h2>
                <p>
                  {dirty
                    ? 'Unsaved changes'
                    : existingId
                      ? 'Saved record'
                      : 'Fill in both names and a stable card ID.'}
                </p>
              </div>
              <button
                type="submit"
                disabled={saving || (!dirty && Boolean(existingId))}
              >
                <Save size={17} /> {saving ? 'Saving…' : 'Save card'}
              </button>
            </div>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            {notice && (
              <output className={styles.notice}>
                <Check size={18} /> {notice}
              </output>
            )}
            <fieldset disabled={saving} className={styles.fields}>
              {ACTIVITY_FIELD_GROUPS.map((group, groupIndex) => (
                <details key={group.title} open={groupIndex === 0 || undefined}>
                  <summary>{group.title}</summary>
                  <div className={styles.grid}>
                    {group.fields.map((field) => {
                      const id = `activity-${field.key}`;
                      const value = form[field.key];
                      const wide =
                        field.kind === 'textarea' || field.kind === 'urls';
                      return (
                        <div
                          key={field.key}
                          className={`${styles.field} ${wide ? styles.wide : ''}`}
                        >
                          {field.kind === 'checkbox' ? (
                            <label className={styles.check} htmlFor={id}>
                              <input
                                id={id}
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(event) =>
                                  setField(field.key, event.target.checked)
                                }
                              />
                              {field.label}
                            </label>
                          ) : (
                            <>
                              <label htmlFor={id}>
                                {field.label}
                                {['id', 'name_en', 'name_ko'].includes(
                                  field.key,
                                )
                                  ? ' *'
                                  : ''}
                              </label>
                              {field.kind === 'rating' ? (
                                <select
                                  id={id}
                                  value={value === null ? '' : String(value)}
                                  onChange={(event) =>
                                    setField(
                                      field.key,
                                      event.target.value === ''
                                        ? null
                                        : Number(event.target.value),
                                    )
                                  }
                                >
                                  <option value="">Not rated yet</option>
                                  {[1, 2, 3, 4, 5].map((rating) => (
                                    <option key={rating} value={rating}>
                                      {rating} {rating === 1 ? 'star' : 'stars'}
                                    </option>
                                  ))}
                                </select>
                              ) : field.options ? (
                                <select
                                  id={id}
                                  value={String(value || '')}
                                  onChange={(event) =>
                                    setField(field.key, event.target.value)
                                  }
                                >
                                  {field.options.map((option) => (
                                    <option key={option} value={option}>
                                      {option.replaceAll('_', ' ')}
                                    </option>
                                  ))}
                                </select>
                              ) : wide ? (
                                <textarea
                                  id={id}
                                  rows={field.kind === 'urls' ? 3 : 4}
                                  value={
                                    Array.isArray(value)
                                      ? value.join('\n')
                                      : String(value || '')
                                  }
                                  onChange={(event) =>
                                    setField(
                                      field.key,
                                      field.kind === 'urls'
                                        ? event.target.value.split('\n')
                                        : event.target.value,
                                    )
                                  }
                                />
                              ) : (
                                <input
                                  id={id}
                                  type={
                                    field.kind === 'number'
                                      ? 'number'
                                      : field.kind === 'url' &&
                                          field.key !== 'image_url'
                                        ? 'url'
                                        : field.kind === 'date'
                                          ? 'date'
                                          : 'text'
                                  }
                                  step={
                                    field.kind === 'number' ? 'any' : undefined
                                  }
                                  value={value === null ? '' : String(value)}
                                  required={[
                                    'id',
                                    'name_en',
                                    'name_ko',
                                  ].includes(field.key)}
                                  disabled={
                                    field.key === 'id' && Boolean(existingId)
                                  }
                                  onChange={(event) =>
                                    setField(
                                      field.key,
                                      field.kind === 'number'
                                        ? event.target.value === ''
                                          ? null
                                          : Number(event.target.value)
                                        : event.target.value,
                                    )
                                  }
                                />
                              )}
                            </>
                          )}
                          {field.hint && <small>{field.hint}</small>}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </fieldset>
            <p className={styles.footnote}>
              Only published records appear on the trip page. Unassigned map
              coordinates stay unassigned; comments are never generated
              automatically.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
