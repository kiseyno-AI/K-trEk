'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { sitePath } from '../lib/site-path';
import type { TripUser } from '../lib/trip-auth';

export function TripLogin({
  onLogin,
  onVisitor,
}: {
  onLogin: (user: TripUser) => void;
  onVisitor: () => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [exists, setExists] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hostAccount = ['shawn', 'sun'].includes(name.toLowerCase());
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, [exists]);
  useEffect(() => () => request.current?.abort(), []);
  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        sitePath(exists === null ? '/api/session/name' : '/api/session'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exists === null ? { name } : { name, password }),
          signal: controller.signal,
        },
      );
      const result = (await response.json()) as {
        error?: string;
        name?: string;
        exists?: boolean;
        user?: TripUser;
      };
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      if (exists === null) {
        if (
          typeof result.name !== 'string' ||
          typeof result.exists !== 'boolean'
        )
          throw new Error('Please try again.');
        setName(result.name);
        setExists(result.exists);
      } else if (result.user) onLogin(result.user);
      else throw new Error('Sign-in could not be completed.');
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : 'Please try again.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <section className="login-stage" aria-label="Join the trip">
      <div className="login-panel">
        <form onSubmit={submit} aria-busy={busy}>
          <div
            key={exists === null ? 'name' : 'password'}
            className="login-step"
          >
            {exists === null ? (
              <>
                <h1>Hi, Cluster E!</h1>
                <p>Thanks for your interest in Korea. What&apos;s your name?</p>
                <label htmlFor="trip-name">First name</label>
                <input
                  ref={input}
                  id="trip-name"
                  autoComplete="username"
                  required
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="login-back"
                  disabled={busy}
                  onClick={() => {
                    setExists(null);
                    setPassword('');
                    setError('');
                  }}
                >
                  <ArrowLeft size={16} /> Change name
                </button>
                <h1>
                  {exists ? 'Welcome,' : 'Nice to meet you,'}
                  <br />
                  {name}.
                </h1>
                <p>
                  {exists
                    ? hostAccount
                      ? 'Your administrator account is ready. Enter your password to sign in.'
                      : 'This name is already registered. Enter your password to sign in.'
                    : hostAccount
                      ? 'This is your administrator account. Please set your own password below.'
                      : 'Let’s create your account. Please set your password below.'}
                </p>
                <label htmlFor="trip-password">
                  {exists ? 'Your password' : 'Set your password'}
                </label>
                <input
                  ref={input}
                  id="trip-password"
                  type="password"
                  autoComplete={exists ? 'current-password' : 'new-password'}
                  required
                  aria-describedby="password-help"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <small id="password-help">
                  <LockKeyhole size={12} />{' '}
                  {exists
                    ? hostAccount
                      ? 'Use the password you set for your administrator account.'
                      : 'Use the password you set for this name.'
                    : 'Choose a password you will remember.'}
                </small>
              </>
            )}
          </div>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="login-submit" disabled={busy} type="submit">
            {busy
              ? 'One moment…'
              : exists === null
                ? 'Continue'
                : exists
                  ? 'Sign in'
                  : 'Create account'}
            <ArrowRight size={18} />
          </button>
        </form>
        <button
          type="button"
          className="visitor-button"
          disabled={busy}
          onClick={onVisitor}
        >
          Continue as a visitor
        </button>
        <p className="visitor-note">
          Visitors can explore. Sign in to save hearts, vote and view routes.
        </p>
      </div>
    </section>
  );
}
