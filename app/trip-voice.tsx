'use client';

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { Check, Play, Send, Volume2, VolumeX, X } from 'lucide-react';
import type { TripUser } from '../lib/trip-auth';
import {
  createTripVoicePlayer,
  type TripVoiceState,
} from '../lib/trip-voice-player';
import {
  createTripInteractionClient,
  type AssistantMessage,
  type InteractionEvent,
} from '../lib/trip-interaction-client';
import { sitePath } from '../lib/site-path';
import styles from './trip-voice.module.css';

type ChatEntry =
  | { id: string; role: 'user'; text: string }
  | (AssistantMessage & { role: 'assistant' });

export function useTripVoice({
  user,
  ready,
  activityId,
  onSessionExpired,
}: {
  user: TripUser | null;
  ready: boolean;
  activityId?: string;
  onSessionExpired?: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TripVoiceState>({
    phase: 'off',
    text: '',
    message: '',
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [eventBusy, setEventBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [reportBusy, setReportBusy] = useState<string | null>(null);
  const [sentReports, setSentReports] = useState<string[]>([]);
  const player = useRef<ReturnType<typeof createTripVoicePlayer> | null>(null);
  const interaction = useRef<ReturnType<
    typeof createTripInteractionClient
  > | null>(null);
  const current = useRef({ enabled, ready, activityId, onSessionExpired });
  useEffect(() => {
    current.current = { enabled, ready, activityId, onSessionExpired };
  }, [enabled, ready, activityId, onSessionExpired]);
  const lastQuestion = useRef<{ message: string; activityId?: string } | null>(
    null,
  );
  const chatPending = useRef(false);
  const reportPending = useRef(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    let active = true;
    let eventThinking = false;
    const voice = createTripVoicePlayer({
      endpoint: sitePath('/api/voice'),
      selectionEndpoint: sitePath('/trip/voice/excellent-choice.mp3'),
      selectionText:
        "Excellent choice! You've got a good eye. This trip is getting better already.",
      onHeard: (messageId) => {
        void interaction.current?.markHeard(messageId);
      },
      onState: (next) => {
        if (!active) return;
        setState(next);
        if (next.phase === 'loading') setOpen(true);
      },
    });
    voice.setIdentity(userId);
    voice.setEnabled(current.current.enabled);
    player.current = voice;
    queueMicrotask(() => {
      if (!active) return;
      setMessages([]);
      setChatError('');
      setCanRetry(false);
      setChatInput('');
      setChatBusy(false);
      setEventBusy(eventThinking);
      setReportBusy(null);
      setSentReports([]);
      setChatOpen(false);
      setOpen(false);
      lastQuestion.current = null;
      chatPending.current = false;
      reportPending.current = false;
    });
    const client = userId
      ? createTripInteractionClient({
          userId,
          endpoint: sitePath('/api/assistant'),
          reportEndpoint: sitePath('/api/reports'),
          visible:
            current.current.ready && document.visibilityState === 'visible',
          voiceEnabled: current.current.enabled,
          onReply: (reply) => {
            if (!active) return;
            setMessages((items) =>
              items.some((item) => item.id === reply.id)
                ? items
                : [...items, { ...reply, role: 'assistant' as const }].slice(
                    -20,
                  ),
            );
            if (
              current.current.enabled &&
              current.current.ready &&
              document.visibilityState === 'visible'
            )
              void voice.speak({
                event: 'assistant',
                messageId: reply.id,
                text: reply.text,
              });
          },
          onError: (message) => {
            if (active) {
              setChatError(message);
              setCanRetry(false);
            }
          },
          onThinking: (value) => {
            eventThinking = value;
            if (active) setEventBusy(value);
          },
          onSessionExpired: () => current.current.onSessionExpired?.(),
        })
      : null;
    interaction.current = client;
    const visibility = () => {
      const visible = document.visibilityState === 'visible';
      client?.setVisible(visible && current.current.ready);
      if (!visible) {
        voice.stop();
        setOpen(false);
      }
    };
    const pagehide = () => {
      voice.stop();
      client?.pagehide();
      setOpen(false);
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    return () => {
      active = false;
      voice.dispose();
      client?.dispose();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      if (player.current === voice) player.current = null;
      if (interaction.current === client) interaction.current = null;
    };
  }, [userId]);

  useEffect(() => {
    player.current?.setEnabled(enabled);
    interaction.current?.setVoiceEnabled(enabled);
    interaction.current?.setVisible(
      ready && document.visibilityState === 'visible',
    );
    if (enabled && userId && ready && document.visibilityState === 'visible')
      void player.current?.speak({ event: 'greeting' });
  }, [enabled, userId, ready]);

  const activityOpened = useCallback((id: string) => {
    interaction.current?.record('card_open', id);
  }, []);
  const selection = useCallback(
    (
      id: string,
      kind: Exclude<
        InteractionEvent,
        'card_open' | 'session_tick'
      > = 'favorite_added',
    ) => {
      interaction.current?.record(kind, id);
      if (
        current.current.enabled &&
        current.current.ready &&
        document.visibilityState === 'visible'
      )
        void player.current?.speak({ event: 'selection', activityId: id });
    },
    [],
  );
  const sendChat = async (retry = false) => {
    const client = interaction.current;
    const question = retry
      ? lastQuestion.current
      : { message: chatInput.trim(), activityId: current.current.activityId };
    if (
      !client ||
      chatPending.current ||
      eventBusy ||
      state.phase === 'loading' ||
      !question?.message
    )
      return;
    chatPending.current = true;
    setChatBusy(true);
    setChatError('');
    setCanRetry(false);
    lastQuestion.current = question;
    if (!retry)
      setMessages((items) =>
        [
          ...items,
          {
            id: crypto.randomUUID(),
            role: 'user' as const,
            text: question.message,
          },
        ].slice(-20),
      );
    try {
      await client.chat(question.message, question.activityId);
      if (interaction.current === client) setChatInput('');
    } catch (error) {
      if (
        interaction.current === client &&
        document.visibilityState === 'visible'
      ) {
        setCanRetry(true);
        setChatError(
          error instanceof Error
            ? error.message
            : 'Your question could not be sent. Try again.',
        );
      }
    } finally {
      if (interaction.current === client) {
        chatPending.current = false;
        setChatBusy(false);
      }
    }
  };
  const askShawn = async (reply: AssistantMessage) => {
    const client = interaction.current;
    if (
      !client ||
      !reply.reportDraft ||
      reportPending.current ||
      sentReports.includes(reply.id)
    )
      return;
    reportPending.current = true;
    setReportBusy(reply.id);
    setChatError('');
    setCanRetry(false);
    try {
      await client.askShawn(reply.reportDraft);
      if (interaction.current === client)
        setSentReports((items) => [...items, reply.id].slice(-20));
    } catch (error) {
      if (
        interaction.current === client &&
        document.visibilityState === 'visible'
      )
        setChatError(
          error instanceof Error
            ? error.message
            : 'Your report could not be sent. Try again.',
        );
    } finally {
      if (interaction.current === client) {
        reportPending.current = false;
        setReportBusy(null);
      }
    }
  };
  return {
    enabled,
    open,
    state,
    activityOpened,
    selection,
    toggle: () => {
      setEnabled((value) => !value);
      setOpen(!enabled);
    },
    retry: () => {
      if (userId && ready && document.visibilityState === 'visible')
        void player.current?.replay();
    },
    replay: () => {
      void player.current?.replay();
    },
    dismiss: () => setOpen(false),
    signedIn: Boolean(userId),
    chatOpen,
    messages,
    chatInput,
    setChatInput,
    chatBusy,
    eventBusy,
    chatError,
    reportBusy,
    sentReports,
    openChat: () => {
      setChatOpen(true);
      setOpen(false);
    },
    closeChat: () => setChatOpen(false),
    sendChat: () => sendChat(),
    retryChat: () => sendChat(true),
    canRetry,
    askShawn,
  };
}

export type TripVoiceActions = Pick<
  ReturnType<typeof useTripVoice>,
  'activityOpened' | 'selection'
>;

export const TripVoiceHost = memo(function TripVoiceHost({
  ref,
  ...options
}: Parameters<typeof useTripVoice>[0] & { ref: Ref<TripVoiceActions> }) {
  const voice = useTripVoice(options);
  useImperativeHandle(
    ref,
    () => ({
      activityOpened: voice.activityOpened,
      selection: voice.selection,
    }),
    [voice.activityOpened, voice.selection],
  );
  return <TripVoiceControl voice={voice} />;
});

export function TripVoiceControl({
  voice,
}: {
  voice: ReturnType<typeof useTripVoice>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const voiceButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLOListElement>(null);
  const thinking =
    voice.chatBusy || voice.eventBusy || voice.state.phase === 'loading';
  useEffect(() => {
    if (voice.chatOpen) {
      if (!dialog.current?.open) dialog.current?.showModal();
      input.current?.focus();
    } else if (dialog.current?.open) {
      dialog.current.close();
      voiceButton.current?.focus();
    }
  }, [voice.chatOpen]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [voice.messages.length, thinking]);
  const playback = thinking ? (
    <output aria-label="Thinking">...</output>
  ) : (
    <>
      <output>
        {voice.state.text ||
          voice.state.message ||
          (voice.signedIn
            ? 'Short welcomes and trip reactions are on.'
            : 'Sign in to hear your welcome. Visitors can explore quietly.')}
      </output>
      {voice.state.text && voice.state.message && (
        <p className={styles.note}>{voice.state.message}</p>
      )}
      {voice.state.phase === 'blocked' && (
        <button type="button" className={styles.play} onClick={voice.replay}>
          <Play size={15} /> Play voice
        </button>
      )}
      {voice.state.phase === 'error' && voice.signedIn && (
        <button type="button" className={styles.play} onClick={voice.retry}>
          Try voice again
        </button>
      )}
    </>
  );
  return (
    <div
      className={styles.control}
      data-trip-voice-phase={voice.state.phase}
      data-trip-voice-latency-ms={voice.state.latencyMs}
    >
      <button
        ref={voiceButton}
        type="button"
        className={styles.toggle}
        aria-label="Open trip voice"
        aria-haspopup="dialog"
        aria-expanded={voice.chatOpen}
        onClick={voice.openChat}
      >
        <Volume2 size={17} />
        <span className={styles.label}>Voice</span>
      </button>
      {voice.enabled && voice.open && !voice.chatOpen && (
        <div className={styles.caption}>
          <div className={styles.captionHeader}>
            <span>AI travel host</span>
            <button
              className={styles.close}
              type="button"
              aria-label="Hide voice message"
              onClick={voice.dismiss}
            >
              <X size={16} />
            </button>
          </div>
          {playback}
        </div>
      )}
      <dialog
        ref={dialog}
        className={styles.chat}
        aria-labelledby="trip-chat-title"
        onCancel={(event) => {
          event.preventDefault();
          voice.closeChat();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.stopPropagation();
        }}
      >
        <div className={styles.chatHeader}>
          <div>
            <h2 id="trip-chat-title">Your Korea trip</h2>
            <p>Ask the AI travel host about places and our plans.</p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close trip voice"
            onClick={voice.closeChat}
          >
            <X size={20} />
          </button>
        </div>
        <div className={styles.voiceSettings}>
          <button
            type="button"
            className={styles.soundToggle}
            aria-label={voice.enabled ? 'Turn voice off' : 'Turn voice on'}
            aria-pressed={voice.enabled}
            onClick={voice.toggle}
          >
            {voice.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}Voice{' '}
            {voice.enabled ? 'on' : 'off'}
          </button>
          {voice.enabled &&
            !thinking &&
            (voice.state.text || voice.state.message) && (
              <div className={styles.voiceTranscript}>{playback}</div>
            )}
        </div>
        {voice.signedIn ? (
          <>
            <ol
              ref={log}
              className={styles.messages}
              role="log"
              aria-label="Trip conversation"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {voice.messages.length === 0 && (
                <li className={styles.empty}>
                  Which place are you curious about? You can chat with voice
                  off.
                </li>
              )}
              {voice.messages.map((entry) => (
                <li
                  key={entry.id}
                  className={
                    entry.role === 'user'
                      ? styles.userMessage
                      : styles.hostMessage
                  }
                >
                  <h3>{entry.role === 'user' ? 'You' : 'AI travel host'}</h3>
                  <p>{entry.text}</p>
                  {entry.role === 'assistant' && entry.sources.length > 0 && (
                    <ul className={styles.sources} aria-label="Reply sources">
                      {entry.sources.map((source) => (
                        <li key={source.activityId}>
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              {source.title}
                            </a>
                          ) : (
                            source.title
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {entry.role === 'assistant' && entry.reportDraft && (
                    <div className={styles.reportDraft}>
                      <p>{entry.reportDraft}</p>
                      <button
                        type="button"
                        className={styles.reportButton}
                        disabled={
                          Boolean(voice.reportBusy) ||
                          voice.sentReports.includes(entry.id)
                        }
                        onClick={() => void voice.askShawn(entry)}
                      >
                        {voice.sentReports.includes(entry.id) ? (
                          <>
                            <Check size={15} /> Sent to Shawn
                          </>
                        ) : voice.reportBusy === entry.id ? (
                          'Sending…'
                        ) : (
                          'Ask Shawn'
                        )}
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {thinking && (
                <li className={styles.thinking}>
                  <output aria-label="Thinking">...</output>
                </li>
              )}
            </ol>
            {voice.chatError && (
              <div className={styles.chatError} role="alert">
                <p>{voice.chatError}</p>
                {voice.canRetry && !thinking && (
                  <button type="button" onClick={() => void voice.retryChat()}>
                    Retry question
                  </button>
                )}
              </div>
            )}
            <form
              className={styles.chatForm}
              aria-label="Ask about the Korea trip"
              aria-busy={thinking}
              onSubmit={(event) => {
                event.preventDefault();
                if (!thinking) void voice.sendChat();
              }}
            >
              <label htmlFor="trip-chat-input">Your trip question</label>
              <div>
                <textarea
                  ref={input}
                  id="trip-chat-input"
                  rows={2}
                  maxLength={1000}
                  value={voice.chatInput}
                  disabled={thinking}
                  onChange={(event) => voice.setChatInput(event.target.value)}
                  placeholder="Ask about this place, food, or travel plans…"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  className={styles.send}
                  disabled={thinking || !voice.chatInput.trim()}
                >
                  <Send size={17} />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <p className={styles.visitor}>
            Sign in to ask questions about the trip. Visitors can keep exploring
            quietly.
          </p>
        )}
      </dialog>
    </div>
  );
}
