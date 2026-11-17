'use client';

import { useEffect, useRef, useState } from 'react';
import { ListChecks, X } from 'lucide-react';
import type { Activity } from '../lib/activities';
import {
  communityRequest,
  CommunityRequestError,
  type TripVoter,
} from '../lib/trip-community-client';
import { MAX_VOTES } from '../lib/vote-planning';
import styles from './trip-community.module.css';

export function HostVoteResults({
  activities,
  ready,
  onSessionExpired,
}: {
  activities: Activity[];
  ready: boolean;
  onSessionExpired?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [votes, setVotes] = useState<TripVoter[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
    return () => { if (node.open) node.close(); };
  }, [open]);

  const close = () => {
    request.current?.abort();
    setOpen(false);
    setBusy(false);
    if (dialog.current?.open) dialog.current.close();
    queueMicrotask(() => {
      if (!dialog.current?.open && launcher.current?.isConnected)
        launcher.current.focus({ preventScroll: true });
    });
  };
  const load = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    setVotes([]);
    try {
      const result = await communityRequest<{ votes: TripVoter[] }>(
        '/api/members?view=votes', controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!Array.isArray(result?.votes) || result.votes.some((voter) =>
        !voter || typeof voter.id !== 'string' || !voter.id ||
        typeof voter.name !== 'string' || !voter.name.trim() ||
        !Array.isArray(voter.submittedVoteIds) ||
        !voter.submittedVoteIds.length || voter.submittedVoteIds.length > MAX_VOTES ||
        voter.submittedVoteIds.some((id) => typeof id !== 'string' || !id)
      )) throw new Error('Vote results could not be read. Please try again.');
      setVotes(result.votes);
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof CommunityRequestError && failure.status === 401)
          onSessionExpired?.();
        setError(failure instanceof CommunityRequestError || failure instanceof Error
          ? failure.message : 'Vote results could not be loaded. Please try again.');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const names = new Map(activities.map((activity) => [activity.id, activity.title]));
  const totals = new Map<string, number>();
  for (const voter of votes)
    for (const id of new Set(voter.submittedVoteIds))
      totals.set(id, (totals.get(id) ?? 0) + 1);
  const results = [...totals].map(([id, count]) => ({
    id, count, title: names.get(id) ?? 'Unavailable activity',
  })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const selections = results.reduce((sum, result) => sum + result.count, 0);

  return (
    <>
      <button
        type="button"
        className={styles.launch}
        style={{ minWidth: 44, minHeight: 44 }}
        aria-label="Voting results"
        title="Voting results"
        disabled={!ready}
        onClick={(event) => {
          if (!ready) return;
          launcher.current = event.currentTarget;
          setOpen(true);
          void load();
        }}
      >
        <ListChecks size={17} />
        <span className={styles.buttonText}>Votes</span>
      </button>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Native dialog backdrop dismissal complements Escape and close buttons. */}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="vote-results-title"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <div className={styles.dialogHeader}>
          <div>
            <h2 id="vote-results-title">Group votes</h2>
            <p aria-live="polite">
              {busy ? 'Loading submitted votes…' : error ? 'Votes are unavailable.' :
                `${votes.length} ${votes.length === 1 ? 'member' : 'members'} submitted · ${selections} ${selections === 1 ? 'selection' : 'selections'}`}
            </p>
          </div>
          <button type="button" className={styles.close} aria-label="Close voting results" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.dialogBody}>
          {busy && <output className={styles.loading}>Loading votes…</output>}
          {error && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => { void load(); }}>Try again</button>
            </div>
          )}
          {!busy && !error && (votes.length ? (
            <>
              <h3>Votes by activity</h3>
              <ol className={styles.rows}>
                {results.map((result) => (
                  <li key={result.id}>
                    <div className={styles.rowHeading}>
                      <strong style={{ overflowWrap: 'anywhere' }}>{result.title}</strong>
                      <span>{result.count} {result.count === 1 ? 'vote' : 'votes'}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <h3>Votes by member</h3>
              <ol className={styles.rows}>
                {votes.map((voter) => (
                  <li key={voter.id}>
                    <div className={styles.rowHeading}>
                      <strong style={{ overflowWrap: 'anywhere' }}>{voter.name}</strong>
                    </div>
                    <ul className={styles.reportText}>
                      {[...new Set(voter.submittedVoteIds)].map((id) => (
                        <li key={id}>{names.get(id) ?? 'Unavailable activity'}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </>
          ) : <p className={styles.empty}>No votes submitted yet.</p>)}
        </div>
        <div className={styles.dialogFooter}>
          <button type="button" className={styles.secondary} onClick={close}>Close</button>
        </div>
      </dialog>
    </>
  );
}
