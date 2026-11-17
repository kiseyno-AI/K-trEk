import type { AssistantMessage } from './trip-assistant';
export type { AssistantMessage } from './trip-assistant';
export type InteractionEvent =
  | 'card_open'
  | 'session_tick'
  | 'favorite_added'
  | 'vote_added';
type StoredEvent = {
  kind: 'event';
  sessionId: string;
  eventId: string;
  event: InteractionEvent;
  activityId?: string;
  elapsedSeconds: number;
  voiceEnabled: boolean;
};
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

export function createTripInteractionClient(options: {
  userId: string;
  endpoint: string;
  reportEndpoint: string;
  visible: boolean;
  voiceEnabled: boolean;
  onReply: (reply: AssistantMessage, source: 'event' | 'chat') => void;
  onThinking?: (thinking: boolean) => void;
  onError: (message: string) => void;
  onSessionExpired?: () => void;
  storage?: StorageAccess;
  fetch?: typeof fetch;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const send = options.fetch ?? fetch;
  const storageKey = `ktravel-interactions:${encodeURIComponent(options.userId)}`;
  const storage = () => {
    try {
      return (
        options.storage ??
        (typeof window === 'undefined' ? undefined : window.sessionStorage)
      );
    } catch {
      return undefined;
    }
  };
  let sessionId = crypto.randomUUID() as string;
  let sequence = 0;
  let elapsedMs = 0;
  let started = false;
  let queue: StoredEvent[] = [];
  try {
    const saved = JSON.parse(storage()?.getItem(storageKey) ?? 'null');
    if (
      saved &&
      /^[A-Za-z0-9_-]{8,100}$/u.test(saved.sessionId) &&
      Number.isSafeInteger(saved.sequence) &&
      saved.sequence >= 0 &&
      Number.isFinite(saved.elapsedMs) &&
      saved.elapsedMs >= 0
    ) {
      sessionId = saved.sessionId;
      started = saved.started === true;
      sequence = saved.sequence;
      elapsedMs = Math.min(saved.elapsedMs, 7 * 86400000);
      queue = Array.isArray(saved.queue)
        ? saved.queue
            .filter(
              (event: StoredEvent) =>
                event?.kind === 'event' &&
                event.sessionId === sessionId &&
                typeof event.eventId === 'string' &&
                /^[A-Za-z0-9_-]{8,100}$/u.test(event.eventId) &&
                [
                  'card_open',
                  'session_tick',
                  'favorite_added',
                  'vote_added',
                ].includes(event.event) &&
                Number.isSafeInteger(event.elapsedSeconds) &&
                event.elapsedSeconds >= 0 &&
                (event.activityId === undefined ||
                  (typeof event.activityId === 'string' &&
                    /^[a-z0-9-]{1,100}$/u.test(event.activityId))),
            )
            .slice(-32)
        : [];
    }
  } catch {
    /* Invalid or unavailable browser storage starts a fresh bounded session. */
  }
  let visible = options.visible;
  let voiceEnabled = options.voiceEnabled;
  let visibleSince = visible ? now() : null;
  let disposed = false;
  let generation = 0;
  let pumping = false;
  let thinking = false;
  const setThinking = (value: boolean) => {
    if (thinking === value) return;
    thinking = value;
    options.onThinking?.(value);
  };
  let heartbeat: ReturnType<typeof setTimeout> | undefined;
  const requests = new Map<AbortController, ReturnType<typeof setTimeout>>();
  const elapsed = () =>
    Math.floor(
      Math.min(
        7 * 86400000,
        elapsedMs +
          (visibleSince === null ? 0 : Math.max(0, now() - visibleSince)),
      ) / 1000,
    );
  const persist = () => {
    try {
      storage()?.setItem(
        storageKey,
        JSON.stringify({
          sessionId,
          started,
          sequence,
          elapsedMs: elapsed() * 1000,
          queue: queue.slice(-32),
        }),
      );
    } catch {
      /* In-memory interaction logging remains available. */
    }
  };
  const errorText = (error: unknown) =>
    error instanceof Error
      ? error.message
      : 'Your trip assistant is unavailable. Please try again.';
  const parseReply = (value: unknown): AssistantMessage => {
    const reply = value as AssistantMessage;
    if (
      !reply ||
      typeof reply.id !== 'string' ||
      reply.id.length > 100 ||
      typeof reply.text !== 'string' ||
      !reply.text.trim() ||
      reply.text.length > 1200 ||
      !Array.isArray(reply.sources) ||
      reply.sources.length > 6 ||
      reply.sources.some(
        (source) =>
          !source ||
          typeof source.activityId !== 'string' ||
          typeof source.title !== 'string' ||
          source.title.length > 160 ||
          (source.url !== undefined &&
            (typeof source.url !== 'string' ||
              !source.url.startsWith('https://'))),
      ) ||
      (reply.reportDraft !== undefined &&
        (typeof reply.reportDraft !== 'string' ||
          reply.reportDraft.length > 2000))
    )
      throw new Error(
        'The assistant returned an unreadable reply. Please try again.',
      );
    return reply;
  };
  const post = async (
    body: unknown,
    endpoint = options.endpoint,
    keepalive = false,
  ) => {
    if (disposed) throw new Error('The trip session has ended.');
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (body as { kind?: string }).kind === 'chat' ? 20000 : 12000,
    );
    requests.set(controller, timeout);
    try {
      const response = await send(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
        keepalive,
      });
      const value = (await response.json()) as {
        error?: string;
        reply?: unknown;
      };
      if (controller.signal.aborted || disposed)
        throw new Error('The assistant request was interrupted.');
      if (!response.ok) {
        if (response.status === 401) options.onSessionExpired?.();
        throw new Error(
          typeof value.error === 'string'
            ? value.error.slice(0, 180)
            : 'Your trip assistant is unavailable. Please try again.',
        );
      }
      return value;
    } finally {
      clearTimeout(timeout);
      requests.delete(controller);
    }
  };
  const pump = async () => {
    if (disposed || !visible || pumping || queue.length === 0) return;
    pumping = true;
    const version = generation;
    try {
      while (!disposed && visible && version === generation && queue.length) {
        const event = queue[0];
        setThinking(voiceEnabled);
        const result = await post({
          ...event,
          voiceEnabled: voiceEnabled && visible,
        });
        if (disposed || !visible || version !== generation) return;
        queue = queue.filter((item) => item.eventId !== event.eventId);
        persist();
        if (result.reply && voiceEnabled)
          options.onReply(parseReply(result.reply), 'event');
      }
    } catch (error) {
      if (!disposed && visible && version === generation)
        options.onError(errorText(error));
    } finally {
      if (version === generation) {
        pumping = false;
        setThinking(false);
      }
    }
  };
  const append = (
    event: InteractionEvent,
    activityId?: string,
  ): StoredEvent => {
    sequence += 1;
    const value: StoredEvent = {
      kind: 'event',
      sessionId,
      eventId: `${sessionId}_${sequence}`,
      event,
      ...(activityId ? { activityId } : {}),
      elapsedSeconds: elapsed(),
      voiceEnabled: voiceEnabled && visible,
    };
    queue = [...queue, value].slice(-32);
    persist();
    return value;
  };
  const scheduleHeartbeat = () => {
    clearTimeout(heartbeat);
    if (!visible || disposed) return;
    heartbeat = setTimeout(() => {
      append('session_tick');
      void pump();
      scheduleHeartbeat();
    }, 60000);
  };
  const abortRequests = () => {
    generation += 1;
    pumping = false;
    setThinking(false);
    requests.forEach((timeout, request) => {
      clearTimeout(timeout);
      request.abort();
    });
    requests.clear();
  };
  const startSession = () => {
    if (!started) {
      started = true;
      append('session_tick');
    }
  };
  if (visible) startSession();
  scheduleHeartbeat();
  void pump();
  return {
    record(
      event: Exclude<InteractionEvent, 'session_tick'>,
      activityId: string,
    ) {
      if (disposed || !visible || !/^[a-z0-9-]{1,100}$/u.test(activityId))
        return;
      append(event, activityId);
      void pump();
    },
    setVoiceEnabled(value: boolean) {
      voiceEnabled = value;
      if (!value) setThinking(false);
    },
    setVisible(value: boolean) {
      if (disposed || visible === value) return;
      if (visibleSince !== null)
        elapsedMs = Math.min(
          7 * 86400000,
          elapsedMs + Math.max(0, now() - visibleSince),
        );
      visible = value;
      visibleSince = value ? now() : null;
      abortRequests();
      persist();
      scheduleHeartbeat();
      if (visible) {
        startSession();
        void pump();
      }
    },
    pagehide() {
      if (disposed) return;
      if (visibleSince !== null)
        elapsedMs = Math.min(
          7 * 86400000,
          elapsedMs + Math.max(0, now() - visibleSince),
        );
      visible = false;
      visibleSince = null;
      clearTimeout(heartbeat);
      abortRequests();
      const tick = append('session_tick');
      void post({ ...tick, voiceEnabled: false }, options.endpoint, true)
        .then(() => {
          if (!disposed) {
            queue = queue.filter((item) => item.eventId !== tick.eventId);
            persist();
          }
        })
        .catch(() => {
          /* The same ID remains in the bounded outbox for the next visible session. */
        });
    },
    async chat(message: string, activityId?: string) {
      const trimmed = message.trim();
      if (!visible || !trimmed || trimmed.length > 1000)
        throw new Error(
          'Write a trip question between 1 and 1,000 characters.',
        );
      const version = generation;
      const result = await post({
        kind: 'chat',
        sessionId,
        message: trimmed,
        ...(activityId ? { activityId } : {}),
      });
      if (disposed || !visible || version !== generation)
        throw new Error(
          'The assistant request was interrupted. Please try again.',
        );
      const reply = parseReply(result.reply);
      options.onReply(reply, 'chat');
      return reply;
    },
    async markHeard(messageId: string) {
      if (disposed || !visible) return;
      try {
        await post({ kind: 'heard', messageId });
      } catch (error) {
        if (!disposed && visible) options.onError(errorText(error));
      }
    },
    async askShawn(message: string) {
      if (!visible || !message.trim() || message.trim().length > 2000)
        throw new Error('Write a report between 1 and 2,000 characters.');
      await post({ message: message.trim() }, options.reportEndpoint);
    },
    dispose() {
      if (disposed) return;
      persist();
      disposed = true;
      clearTimeout(heartbeat);
      abortRequests();
    },
  };
}
