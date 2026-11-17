export type TripVoiceEvent =
  | { event: 'greeting' }
  | { event: 'selection'; activityId: string }
  | { event: 'assistant'; messageId: string; text: string };
export type TripVoiceState = {
  phase: 'off' | 'ready' | 'loading' | 'playing' | 'blocked' | 'error';
  text: string;
  message: string;
  latencyMs?: number;
};
type Dependencies = {
  endpoint: string;
  selectionEndpoint: string;
  selectionText: string;
  onState: (state: TripVoiceState) => void;
  onHeard?: (messageId: string) => void;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  fetch?: typeof fetch;
  createAudio?: () => HTMLAudioElement;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  now?: () => number;
};

export function createTripVoicePlayer(options: Dependencies) {
  const send = options.fetch ?? fetch;
  const makeAudio = options.createAudio ?? (() => new Audio());
  const makeUrl =
    options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeUrl =
    options.revokeObjectURL ?? ((value: string) => URL.revokeObjectURL(value));
  const now = options.now ?? Date.now;
  let enabled = false;
  let disposed = false;
  let generation = 0;
  let request: AbortController | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let audio: HTMLAudioElement | null = null;
  let url: string | null = null;
  let text = '';
  let selectionBlob: Blob | null = null;
  let lastSelection = -Infinity;
  let identity: string | null = null;
  let pendingEvent: TripVoiceEvent | null = null;
  let heard = {
    greeting: false,
    selection: false,
    events: [] as string[],
    texts: [] as string[],
  };
  const normalize = (value: string) =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .slice(0, 1200);
  const storage = () => {
    try {
      return (
        options.storage ??
        (typeof window === 'undefined' ? undefined : window.localStorage)
      );
    } catch {
      return undefined;
    }
  };
  const storageKey = () =>
    `ktravel-heard:${encodeURIComponent(identity ?? '')}`;
  const refreshHeard = () => {
    if (!identity) return;
    try {
      const saved = JSON.parse(storage()?.getItem(storageKey()) ?? 'null');
      if (!saved || typeof saved !== 'object') return;
      const strings = (values: unknown, limit: number): string[] =>
        Array.isArray(values)
          ? values
              .filter(
                (item): item is string =>
                  typeof item === 'string' && item.length <= limit,
              )
              .slice(-128)
          : [];
      heard = {
        greeting: heard.greeting || saved.greeting === true,
        selection: heard.selection || saved.selection === true,
        events: [
          ...new Set([...heard.events, ...strings(saved.events, 100)]),
        ].slice(-128),
        texts: [
          ...new Set([...heard.texts, ...strings(saved.texts, 1200)]),
        ].slice(-128),
      };
    } catch {
      /* Unavailable storage must preserve this tab's heard ledger. */
    }
  };
  const alreadyHeard = (event: TripVoiceEvent, value: string) => {
    refreshHeard();
    return (
      identity !== null &&
      ((event.event === 'greeting' && heard.greeting) ||
        (event.event === 'selection' && heard.selection) ||
        (event.event === 'assistant' &&
          heard.events.includes(event.messageId)) ||
        (Boolean(normalize(value)) && heard.texts.includes(normalize(value))))
    );
  };
  const markHeard = () => {
    if (!pendingEvent) return;
    if (pendingEvent.event === 'selection') lastSelection = now();
    if (identity) {
      refreshHeard();
      if (pendingEvent.event === 'greeting') heard.greeting = true;
      if (pendingEvent.event === 'selection') heard.selection = true;
      if (pendingEvent.event === 'assistant')
        heard.events = [
          ...new Set([...heard.events, pendingEvent.messageId]),
        ].slice(-128);
      const spokenTexts = [
        text,
        pendingEvent.event === 'assistant' ? pendingEvent.text : '',
      ]
        .map(normalize)
        .filter(Boolean);
      heard.texts = [...new Set([...heard.texts, ...spokenTexts])].slice(-128);
      try {
        storage()?.setItem(storageKey(), JSON.stringify(heard));
      } catch {
        /* Keep this session deduplicated when storage is unavailable. */
      }
    }
    if (pendingEvent.event === 'assistant')
      options.onHeard?.(pendingEvent.messageId);
  };
  const publish = (
    phase: TripVoiceState['phase'],
    message = '',
    latencyMs?: number,
  ) => {
    if (!disposed) options.onState({ phase, text, message, latencyMs });
  };
  const release = () => {
    generation += 1;
    request?.abort();
    request = null;
    clearTimeout(deadline);
    deadline = undefined;
    audio?.pause();
    audio?.removeAttribute('src');
    audio?.load();
    if (url) revokeUrl(url);
    url = null;
  };
  const ended = () => {
    if (!audio?.ended || !url) return;
    release();
    publish(enabled ? 'ready' : 'off');
  };
  const failed = () => {
    if (!audio?.error || !url) return;
    release();
    publish('error', 'This voice could not play. Please try again.');
  };
  const play = async (startedAt = now()) => {
    if (!enabled || disposed || !audio || !url) return;
    const version = generation;
    try {
      await audio.play();
      if (version === generation && enabled && !disposed) {
        markHeard();
        const elapsed = now() - startedAt;
        publish(
          'playing',
          '',
          Number.isFinite(elapsed)
            ? Math.max(0, Math.round(elapsed))
            : undefined,
        );
      }
    } catch (error) {
      if (version !== generation || disposed) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError')
        publish('blocked', 'Press Play voice to hear your host.');
      else {
        release();
        publish('error', 'This voice could not play. Please try again.');
      }
    }
  };
  const player = {
    setIdentity(value: string | null) {
      if (identity === value) return;
      release();
      selectionBlob = null;
      pendingEvent = null;
      text = '';
      identity = value;
      heard = { greeting: false, selection: false, events: [], texts: [] };
      refreshHeard();
      publish(enabled ? 'ready' : 'off');
    },
    setEnabled(value: boolean) {
      enabled = value;
      release();
      if (!enabled) selectionBlob = null;
      text = '';
      publish(enabled ? 'ready' : 'off');
    },
    stop() {
      release();
      publish(enabled ? 'ready' : 'off');
    },
    async speak(event: TripVoiceEvent) {
      if (!enabled || disposed) return;
      const selection = event.event === 'selection';
      const knownText = selection
        ? options.selectionText
        : event.event === 'assistant'
          ? event.text
          : '';
      if (alreadyHeard(event, knownText)) return;
      if (selection && now() - lastSelection < 12000) return;
      const startedAt = now();
      release();
      const version = generation;
      const controller = new AbortController();
      pendingEvent = event;
      text = knownText;
      publish('loading', 'Your host is preparing a short reaction…');
      try {
        let blob = selection ? selectionBlob : null;
        if (!blob) {
          request = controller;
          deadline = setTimeout(() => controller.abort(), 45000);
          const response = await send(
            selection ? options.selectionEndpoint : options.endpoint,
            selection
              ? {
                  method: 'GET',
                  cache: 'force-cache',
                  signal: controller.signal,
                }
              : {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(
                    event.event === 'assistant'
                      ? { event: 'assistant', messageId: event.messageId }
                      : event,
                  ),
                  cache: 'no-store',
                  signal: controller.signal,
                },
          );
          if (version !== generation) return;
          if (controller.signal.aborted)
            throw new Error('Voice took too long.');
          if (!response.ok) {
            if (selection)
              throw new Error('Voice is unavailable. Please try again.');
            const body = (await response.json()) as {
              error?: unknown;
              text?: unknown;
            };
            if (version !== generation) return;
            if (controller.signal.aborted)
              throw new Error('Voice took too long.');
            if (typeof body.text === 'string') text = body.text.slice(0, 600);
            throw new Error(
              typeof body.error === 'string'
                ? body.error.slice(0, 180)
                : 'Voice is unavailable. Please try again.',
            );
          }
          if (!response.headers.get('content-type')?.startsWith('audio/mpeg'))
            throw new Error('Voice is unavailable. Please try again.');
          blob = await response.blob();
          if (version !== generation) return;
          if (controller.signal.aborted)
            throw new Error('Voice took too long.');
          if (!blob.size || blob.size > 512 * 1024)
            throw new Error('Voice is unavailable. Please try again.');
          if (selection) selectionBlob = blob;
          else {
            try {
              text = decodeURIComponent(
                response.headers.get('x-trip-voice-text')?.slice(0, 2000) ?? '',
              );
            } catch {
              throw new Error('Voice is unavailable. Please try again.');
            }
          }
        }
        if (alreadyHeard(event, text)) {
          release();
          publish('ready');
          return;
        }
        if (!audio) {
          audio = makeAudio();
          audio.preload = 'none';
          audio.addEventListener('ended', ended);
          audio.addEventListener('error', failed);
        }
        url = makeUrl(blob);
        audio.src = url;
        request = null;
        clearTimeout(deadline);
        deadline = undefined;
        await play(startedAt);
      } catch (error) {
        if (version !== generation || disposed) return;
        const timedOut = controller.signal.aborted;
        release();
        publish(
          'error',
          timedOut
            ? 'Voice took too long. Please try again.'
            : error instanceof Error
              ? error.message
              : 'Voice is unavailable. Please try again.',
        );
      } finally {
        if (version === generation) {
          request = null;
          clearTimeout(deadline);
          deadline = undefined;
        }
      }
    },
    async replay() {
      if (pendingEvent && alreadyHeard(pendingEvent, text)) return;
      if (url) await play();
      else if (pendingEvent) await player.speak(pendingEvent);
    },
    dispose() {
      disposed = true;
      enabled = false;
      release();
      audio?.removeEventListener('ended', ended);
      audio?.removeEventListener('error', failed);
      audio = null;
      selectionBlob = null;
    },
  };
  return player;
}
