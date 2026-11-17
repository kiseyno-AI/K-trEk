'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import { Check, MessageSquare, Send, UsersRound, X } from 'lucide-react';
import { CATEGORIES, type Activity } from '../lib/activities';
import type { TripUser } from '../lib/trip-auth';
import {
  CommunityRequestError,
  communityRequest,
  createMemberPreferenceSync,
  type MemberPreferences,
  type TripMember,
  type TripReport,
} from '../lib/trip-community-client';
import styles from './trip-community.module.css';
import { HostVoteResults } from './host-vote-results';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/New_York',
});
const dateLabel = (value: number) =>
  Number.isFinite(value) ? dateFormat.format(value) : 'Date unavailable';
const errorLabel = (error: unknown) =>
  error instanceof Error ? error.message : 'Please try again.';
const expired = (error: unknown, onSessionExpired?: () => void) => {
  if (error instanceof CommunityRequestError && error.status === 401)
    onSessionExpired?.();
};

export function useMemberPreferences({
  user,
  hydrated,
  draftVoteIds,
  submittedVoteIds,
  onRestore,
  onSessionExpired,
}: {
  user: TripUser | null;
  hydrated: boolean;
  draftVoteIds: string[];
  submittedVoteIds: string[];
  onRestore: (
    votes: Pick<MemberPreferences, 'draftVoteIds' | 'submittedVoteIds'>,
  ) => void;
  onSessionExpired?: () => void;
}) {
  const userId = user?.id ?? null;
  const [syncStatus, setSyncStatus] = useState({ owner: '', error: '' });
  const currentVotes = useRef({ draftVoteIds, submittedVoteIds });
  useEffect(() => {
    currentVotes.current = { draftVoteIds, submittedVoteIds };
  }, [draftVoteIds, submittedVoteIds]);
  const sync = useRef<ReturnType<typeof createMemberPreferenceSync> | null>(
    null,
  );
  useEffect(() => {
    if (!userId || !hydrated) return;
    const owner = createMemberPreferenceSync({
      initialVotes: currentVotes.current,
      onRestore,
      onError: (error) => setSyncStatus({ owner: userId, error }),
      onSessionExpired,
    });
    sync.current = owner;
    return () => {
      owner.dispose();
      if (sync.current === owner) sync.current = null;
    };
  }, [userId, hydrated, onRestore, onSessionExpired]);
  useEffect(() => {
    sync.current?.updateVotes(draftVoteIds, submittedVoteIds);
  }, [draftVoteIds, submittedVoteIds]);
  const recordCategory = useCallback(
    (id: string) => sync.current?.recordCategory(id),
    [],
  );
  const flushPreferences = useCallback(async () => {
    await sync.current?.flush();
  }, []);
  const submitVote = useCallback(async (ids: string[]) => {
    if (!sync.current)
      throw new CommunityRequestError('Your choices are still loading. Please try again.');
    return sync.current.submitVote(ids);
  }, []);
  return {
    recordCategory,
    flushPreferences,
    submitVote,
    syncError: syncStatus.owner === userId ? syncStatus.error : '',
  };
}

export function ReportComposer({
  user,
  onSessionExpired,
}: {
  user: TripUser;
  onSessionExpired?: () => void;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), [user.id]);
  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !message.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    setSent(false);
    try {
      await communityRequest('/api/reports', controller.signal, {
        method: 'POST',
        body: { message: message.trim() },
      });
      if (!controller.signal.aborted) {
        setMessage('');
        setSent(true);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        expired(failure, onSessionExpired);
        setError(errorLabel(failure));
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <form
      className={styles.composer}
      onSubmit={submit}
      aria-label="Report to Shawn"
      aria-busy={busy}
    >
      <label htmlFor={`trip-report-${user.id}`}>Report to Shawn</label>
      <textarea
        id={`trip-report-${user.id}`}
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          setSent(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.stopPropagation();
        }}
        placeholder="Tell us what needs fixing or share an idea."
        required
        maxLength={2000}
        rows={3}
        disabled={busy}
      />
      <button
        className={styles.send}
        type="submit"
        disabled={busy || !message.trim()}
      >
        <Send size={15} /> {busy ? 'Sending…' : 'Send report'}
      </button>
      {error && (
        <p className={styles.notice} role="alert">
          {error}
        </p>
      )}
      {sent && (
        <output className={styles.notice}>
          <Check size={14} /> Sent to Shawn.
        </output>
      )}
    </form>
  );
}

export function CommunityControls(props: {
  user: TripUser | null;
  activities: Activity[];
  ready: boolean;
  onSessionExpired?: () => void;
}) {
  if (
    props.user?.role !== 'admin' ||
    !['shawn', 'sun'].includes(props.user.name.normalize('NFKC').toLowerCase())
  )
    return null;
  return (
    <div className={styles.controls}>
      <HostVoteResults
        key={`${props.user.id}:votes`}
        activities={props.activities}
        ready={props.ready}
        onSessionExpired={props.onSessionExpired}
      />
      {props.user.name.normalize('NFKC').toLowerCase() === 'shawn' &&
        <ShawnCommunity key={props.user.id} {...props} />}
    </div>
  );
}

function ShawnCommunity({
  activities,
  ready,
  onSessionExpired,
}: {
  activities: Activity[];
  ready: boolean;
  onSessionExpired?: () => void;
}) {
  const [reports, setReports] = useState<TripReport[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [panel, setPanel] = useState<'reports' | 'members' | null>(null);
  const [reportsBusy, setReportsBusy] = useState(false);
  const [membersBusy, setMembersBusy] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [membersError, setMembersError] = useState('');
  const reportsRequest = useRef<AbortController | null>(null);
  const membersRequest = useRef<AbortController | null>(null);
  const prompted = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const reportsButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const unread = reports.filter((report) => report.readAt === null);
  const open = panel !== null;

  const loadReports = useCallback(async () => {
    reportsRequest.current?.abort();
    const controller = new AbortController();
    reportsRequest.current = controller;
    setReportsBusy(true);
    setReportsError('');
    try {
      const result = await communityRequest<{ reports: TripReport[] }>(
        '/api/reports',
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!Array.isArray(result.reports))
        throw new Error('Reports could not be read.');
      setReports(result.reports);
      if (!prompted.current) {
        prompted.current = true;
        if (result.reports.some((report) => report.readAt === null)) {
          returnFocus.current = reportsButton.current;
          setPanel((current) => current ?? 'reports');
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        expired(failure, onSessionExpired);
        setReportsError(errorLabel(failure));
      }
    } finally {
      if (!controller.signal.aborted) setReportsBusy(false);
    }
  }, [onSessionExpired]);

  const loadMembers = async () => {
    membersRequest.current?.abort();
    const controller = new AbortController();
    membersRequest.current = controller;
    setMembersBusy(true);
    setMembersError('');
    try {
      const result = await communityRequest<{ members: TripMember[] }>(
        '/api/members',
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!Array.isArray(result.members))
        throw new Error('Members could not be read.');
      setMembers(result.members);
    } catch (failure) {
      if (!controller.signal.aborted) {
        expired(failure, onSessionExpired);
        setMembersError(errorLabel(failure));
      }
    } finally {
      if (!controller.signal.aborted) setMembersBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (ready)
      queueMicrotask(() => {
        if (active) void loadReports();
      });
    return () => {
      active = false;
    };
  }, [ready, loadReports]);
  useEffect(
    () => () => {
      reportsRequest.current?.abort();
      membersRequest.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
    if (!open)
      queueMicrotask(() => {
        if (!node.open && returnFocus.current?.isConnected)
          returnFocus.current.focus({ preventScroll: true });
      });
    return () => {
      if (node.open) node.close();
    };
  }, [open]);

  const close = () => {
    setPanel(null);
    membersRequest.current?.abort();
  };
  const markRead = async () => {
    if (!unread.length || reportsBusy) return;
    reportsRequest.current?.abort();
    const controller = new AbortController();
    reportsRequest.current = controller;
    setReportsBusy(true);
    setReportsError('');
    try {
      const result = await communityRequest<{ reports: TripReport[] }>(
        '/api/reports',
        controller.signal,
        {
          method: 'PATCH',
          body: { reportIds: unread.slice(0, 100).map((report) => report.id) },
        },
      );
      if (!controller.signal.aborted) {
        if (!Array.isArray(result.reports))
          throw new Error('Report status could not be read.');
        setReports(result.reports);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        expired(failure, onSessionExpired);
        setReportsError(errorLabel(failure));
      }
    } finally {
      if (!controller.signal.aborted) setReportsBusy(false);
    }
  };
  const activityNames = (ids: string[]) =>
    ids.map(
      (id) =>
        activities.find((activity) => activity.id === id)?.title ??
        'Unavailable activity',
    );
  const choiceList = (items: string[]) =>
    items.length ? (
      <ul>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    ) : (
      <span className={styles.emptyChoice}>No selections yet.</span>
    );

  return (
    <>
      <div className={styles.controls}>
        <button
          ref={reportsButton}
          type="button"
          className={styles.launch}
          aria-label={`Reports${unread.length ? ` (${unread.length} unread)` : ''}`}
          title="Member reports"
          disabled={!ready}
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
            prompted.current = true;
            setPanel('reports');
            void loadReports();
          }}
        >
          <MessageSquare size={17} />
          <span className={styles.buttonText}>Reports</span>
          {unread.length > 0 && <b className={styles.count}>{unread.length}</b>}
        </button>
        <button
          type="button"
          className={styles.launch}
          aria-label="Members and preferences"
          title="Members and preferences"
          disabled={!ready}
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
            setPanel('members');
            void loadMembers();
          }}
        >
          <UsersRound size={17} />
          <span className={styles.buttonText}>Members</span>
        </button>
      </div>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="community-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.stopPropagation();
        }}
      >
        <div className={styles.dialogHeader}>
          <div>
            <h2 id="community-title">
              {panel === 'members' ? 'Members & preferences' : 'Member reports'}
            </h2>
            <p>
              {panel === 'members'
                ? membersBusy
                  ? 'Checking registered members…'
                  : membersError
                    ? 'Members are unavailable.'
                    : `${members.length} registered members`
                : reportsBusy
                  ? 'Checking reports…'
                  : reportsError
                    ? 'Reports are unavailable.'
                    : unread.length
                      ? `${unread.length} unread ${unread.length === 1 ? 'report' : 'reports'}`
                      : 'All reports are read.'}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close community window"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <div className={styles.dialogBody}>
          {(panel === 'members' ? membersError : reportsError) && (
            <div className={styles.error} role="alert">
              <p>{panel === 'members' ? membersError : reportsError}</p>
              <button
                type="button"
                onClick={() => {
                  if (panel === 'members') void loadMembers();
                  else void loadReports();
                }}
              >
                Try again
              </button>
            </div>
          )}
          {(panel === 'members' ? membersBusy : reportsBusy) && (
            <output className={styles.loading}>
              {panel === 'members' ? 'Loading members…' : 'Loading reports…'}
            </output>
          )}
          {panel === 'reports' &&
            (reports.length ? (
              <ol className={styles.rows}>
                {reports.map((report) => (
                  <li key={report.id}>
                    <div className={styles.rowHeading}>
                      <strong>{report.memberName}</strong>
                      {report.readAt === null && (
                        <span className={styles.unread}>Unread</span>
                      )}
                    </div>
                    <time>{dateLabel(report.createdAt)} · ET</time>
                    <p className={styles.reportText}>{report.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              !reportsBusy &&
              !reportsError && <p className={styles.empty}>No reports yet.</p>
            ))}
          {panel === 'members' &&
            (members.length ? (
              <ol className={styles.rows}>
                {members.map((member) => (
                  <li key={member.id}>
                    <div className={styles.rowHeading}>
                      <h3>{member.name}</h3>
                      {member.role === 'admin' && (
                        <span className={styles.role}>Admin</span>
                      )}
                    </div>
                    <p className={styles.joined}>
                      Joined {dateLabel(member.createdAt)} · ET
                    </p>
                    <dl className={styles.memberChoices}>
                      <div>
                        <dt>Category interests</dt>
                        <dd>
                          {choiceList(
                            member.categoryIds.map(
                              (id) =>
                                CATEGORIES[id as keyof typeof CATEGORIES] ?? id,
                            ),
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Saved hearts</dt>
                        <dd>{choiceList(activityNames(member.favoriteIds))}</dd>
                      </div>
                      <div>
                        <dt>Voting draft</dt>
                        <dd>
                          {choiceList(activityNames(member.draftVoteIds))}
                        </dd>
                      </div>
                      <div>
                        <dt>Submitted vote</dt>
                        <dd>
                          {choiceList(activityNames(member.submittedVoteIds))}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            ) : (
              !membersBusy &&
              !membersError && <p className={styles.empty}>No members yet.</p>
            ))}
        </div>
        <div className={styles.dialogFooter}>
          {panel === 'reports' && unread.length > 0 && (
            <button
              type="button"
              className={styles.primary}
              disabled={reportsBusy}
              onClick={() => void markRead()}
            >
              <Check size={16} /> Mark {Math.min(unread.length, 100)} as read
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={close}>
            {panel === 'reports' && unread.length ? 'Later' : 'Close'}
          </button>
        </div>
      </dialog>
    </>
  );
}
