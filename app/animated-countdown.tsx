'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import styles from './animated-countdown.module.css';

const segments = [
  '4,1 22,1 19,4 7,4',
  '23,2 23,20 20,18 20,6',
  '23,23 23,41 20,37 20,25',
  '4,43 22,43 19,40 7,40',
  '3,23 6,25 6,37 3,41',
  '3,2 6,6 6,18 3,20',
  '5,22 8,19 18,19 21,22 18,25 8,25',
];
const litSegments = [
  'abcdef',
  'bc',
  'abdeg',
  'abcdg',
  'bcfg',
  'acdfg',
  'acdefg',
  'abc',
  'abcdefg',
  'abcdfg',
];

export function AnimatedCountdown({
  value,
  dateTime,
  active,
}: {
  value: string;
  dateTime: string;
  active: boolean;
}) {
  const element = useRef<HTMLTimeElement>(null);
  const previous = useRef({ value, active });
  const animations = useRef<Animation[]>([]);
  const stop = useCallback(() => {
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
  }, []);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { value, active };
    stop();
    if (
      !active ||
      !before.active ||
      before.value.length !== value.length ||
      document.hidden ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;

    for (const glyph of element.current?.querySelectorAll<HTMLElement>(
      '[data-countdown-digit]',
    ) ?? []) {
      const index = Number(glyph.dataset.countdownDigit);
      if (before.value[index] === value[index] || !glyph.animate) continue;
      const animation = glyph.animate(
        [
          { transform: 'translateY(55%)', opacity: 0.25 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: 160, easing: 'cubic-bezier(.16,1,.3,1)' },
      );
      animations.current.push(animation);
      void animation.finished.then(
        () => {
          animations.current = animations.current.filter(
            (owned) => owned !== animation,
          );
        },
        () => {},
      );
    }
    return stop;
  }, [value, active, stop]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const pause = () => {
      if (document.hidden) previous.current.active = false;
      if (preference.matches || document.hidden) stop();
    };
    preference.addEventListener('change', pause);
    document.addEventListener('visibilitychange', pause);
    pause();
    return () => {
      preference.removeEventListener('change', pause);
      document.removeEventListener('visibilitychange', pause);
      stop();
    };
  }, [stop]);

  const groups = value.split(':');

  return (
    <time
      ref={element}
      className={styles.screen}
      dateTime={dateTime}
      aria-label={value}
      suppressHydrationWarning
    >
      <span className={styles.value} aria-hidden="true">
        {groups.map((group, groupIndex) => {
          const start = groups
            .slice(0, groupIndex)
            .reduce((offset, part) => offset + part.length + 1, 0);
          return (
            <Fragment key={groupIndex}>
              {groupIndex > 0 && (
                <span className={styles.colon}>
                  <i />
                  <i />
                </span>
              )}
              <span className={styles.group}>
                <span className={styles.digits}>
                  {group.split('').map((character, index) => (
                    <span className={styles.digit} key={index}>
                      <span
                        className={styles.glyph}
                        data-countdown-digit={start + index}
                        suppressHydrationWarning
                      >
                        {/\d/.test(character) ? (
                          <svg
                            viewBox="0 0 26 44"
                            data-digit={character}
                            focusable="false"
                            aria-hidden="true"
                          >
                            {segments.map((points, segment) => (
                              <polygon
                                key={segment}
                                points={points}
                                data-lit={litSegments[
                                  Number(character)
                                ].includes('abcdefg'[segment])}
                              />
                            ))}
                          </svg>
                        ) : (
                          character
                        )}
                      </span>
                    </span>
                  ))}
                </span>
                <span className={styles.unit}>
                  {['HOURS', 'MINUTES', 'SECONDS'][groupIndex]}
                </span>
              </span>
            </Fragment>
          );
        })}
      </span>
    </time>
  );
}
