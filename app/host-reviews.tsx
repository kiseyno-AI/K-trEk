'use client';

import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { Star } from 'lucide-react';
import type { Activity } from '../lib/activities';
import { sitePath } from '../lib/site-path';
import styles from './host-reviews.module.css';

export type HostReviewValues = Pick<
  Activity['details'],
  'shawn_comment' | 'sun_comment' | 'shawn_rating' | 'sun_rating'
>;

const hosts = [
  { name: 'Shawn', rating: 'shawn_rating', comment: 'shawn_comment' },
  { name: 'Sun', rating: 'sun_rating', comment: 'sun_comment' },
] as const;

function confirmedReviews(value: unknown): HostReviewValues | null {
  if (!value || typeof value !== 'object') return null;
  const reviews = value as Record<string, unknown>;
  for (const { rating, comment } of hosts) {
    const stars = reviews[rating];
    const text = reviews[comment];
    if (
      (stars !== null &&
        (typeof stars !== 'number' ||
          !Number.isInteger(stars) ||
          stars < 1 ||
          stars > 5)) ||
      (text !== null && (typeof text !== 'string' || text.length > 10000))
    )
      return null;
  }
  return {
    shawn_comment: reviews.shawn_comment as string | null,
    sun_comment: reviews.sun_comment as string | null,
    shawn_rating: reviews.shawn_rating as number | null,
    sun_rating: reviews.sun_rating as number | null,
  };
}

export function HostReviews({
  activity,
  canEdit,
  onSaved,
}: {
  activity: Activity;
  canEdit: boolean;
  onSaved: (reviews: HostReviewValues) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<HostReviewValues>(() => ({
    shawn_comment: activity.details.shawn_comment,
    sun_comment: activity.details.sun_comment,
    shawn_rating: activity.details.shawn_rating,
    sun_rating: activity.details.sun_rating,
  }));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [activity.id, canEdit],
  );
  const change = <Key extends keyof HostReviewValues>(
    key: Key,
    value: HostReviewValues[Key],
  ) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setFeedback(null);
  };
  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setFeedback(null);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    try {
      const response = await fetch(
        sitePath(`/api/activities/${activity.id}/reviews`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...draft,
            shawn_comment: draft.shawn_comment?.trim() || null,
            sun_comment: draft.sun_comment?.trim() || null,
          }),
          signal: controller.signal,
        },
      );
      const result = (await response.json()) as {
        reviews?: unknown;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || 'Comments could not be saved.');
      const reviews = confirmedReviews(result.reviews);
      if (!reviews)
        throw new Error(
          'The server did not confirm this save. Please try again.',
        );
      if (request.current !== controller || controller.signal.aborted) return;
      setDraft(reviews);
      onSaved(reviews);
      setFeedback({ text: 'Comments saved.', error: false });
    } catch (failure) {
      if (
        request.current === controller &&
        (!controller.signal.aborted || timedOut)
      )
        setFeedback({
          text: timedOut
            ? 'Saving timed out. Your draft is still here. Please try again.'
            : failure instanceof Error
              ? failure.message
              : 'Comments could not be saved. Please try again.',
          error: true,
        });
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  };
  if (canEdit)
    return (
      <form
        className={styles.editor}
        aria-label={`Host comments for ${activity.title}`}
        aria-busy={busy}
        onSubmit={save}
      >
        <p className={styles.hint}>
          Two or three sentences work well. Save to update this card.
        </p>
        {hosts.map(({ name, rating, comment }) => (
          <fieldset key={name} className={styles.host} disabled={busy}>
            <legend>{name}&apos;s comment</legend>
            <fieldset className={styles.ratingField}>
              <legend>Set {name}&apos;s rating</legend>
              <div className={styles.ratingChoices}>
                <label className={styles.unrated}>
                  <input
                    type="radio"
                    name={`${id}-${rating}`}
                    value="0"
                    checked={draft[rating] === null}
                    onChange={() => change(rating, null)}
                  />
                  Unrated
                </label>
                {[1, 2, 3, 4, 5].map((star) => (
                  <label
                    key={star}
                    className={styles.starChoice}
                    data-filled={star <= (draft[rating] ?? 0)}
                    title={`${star} ${star === 1 ? 'star' : 'stars'}`}
                  >
                    <input
                      type="radio"
                      name={`${id}-${rating}`}
                      value={star}
                      aria-label={`${name}: ${star} ${star === 1 ? 'star' : 'stars'}`}
                      checked={draft[rating] === star}
                      onChange={() => change(rating, star)}
                    />
                    <Star aria-hidden="true" />
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={styles.commentLabel} htmlFor={`${id}-${comment}`}>
              Comment
            </label>
            <textarea
              id={`${id}-${comment}`}
              rows={3}
              maxLength={10000}
              value={draft[comment] ?? ''}
              onChange={(event) => change(comment, event.target.value)}
            />
          </fieldset>
        ))}
        <button className={styles.save} type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save comments'}
        </button>
        {feedback && (
          <p
            className={feedback.error ? styles.error : styles.saved}
            role={feedback.error ? 'alert' : 'status'}
          >
            {feedback.text}
          </p>
        )}
      </form>
    );
  return (
    <ul className={styles.list} aria-label="Shawn and Sun comments">
      {hosts.map(({ name, rating, comment }) => (
        <li key={name}>
          <div className={styles.row}>
            <h2>{name}&apos;s comment</h2>
            <figure
              className={styles.rating}
              aria-label={
                activity.details[rating] === null
                  ? 'Not rated yet'
                  : `${activity.details[rating]} out of 5 stars`
              }
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  aria-hidden="true"
                  data-filled={star <= (activity.details[rating] ?? 0)}
                />
              ))}
            </figure>
          </div>
          <p className={activity.details[comment] ? undefined : styles.empty}>
            {activity.details[comment] || `${name} hasn't added a comment yet.`}
          </p>
        </li>
      ))}
    </ul>
  );
}
