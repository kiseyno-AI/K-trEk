type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export function flyCards(
  cards: HTMLElement[],
  direction: 'enter' | 'exit',
  viewportWidth: number,
): Animation[] {
  const frames = cards.map((card) => [
    {
      opacity: 0,
      translate: `${viewportWidth - card.getBoundingClientRect().left + 48}px 12px`,
      rotate: '2deg',
    },
    {
      opacity: getComputedStyle(card).opacity,
      translate: '0 0',
      rotate: '0deg',
    },
  ]);
  return cards.map((card, order) =>
    card.animate(
      direction === 'enter' ? frames[order] : frames[order].toReversed(),
      {
        duration: direction === 'enter' ? 820 : 460,
        delay: order * (direction === 'enter' ? 95 : 55),
        easing:
          direction === 'enter'
            ? 'cubic-bezier(.16,1,.3,1)'
            : 'cubic-bezier(.55,0,.85,.4)',
        fill: direction === 'enter' ? 'backwards' : 'forwards',
      },
    ),
  );
}

export type CardMorphSource = {
  card: Rect;
  photo: Rect;
  copy: Rect;
  title: Rect;
};

const frame = ({ left, top, width, height }: Rect) => ({
  left: `${left}px`,
  top: `${top}px`,
  width: `${width}px`,
  height: `${height}px`,
});

const clipCopy = (surface: Rect, copy: Rect) =>
  `inset(${Math.max(0, surface.top - copy.top)}px ${Math.max(0, copy.left + copy.width - surface.left - surface.width)}px ${Math.max(0, copy.top + copy.height - surface.top - surface.height)}px ${Math.max(0, surface.left - copy.left)}px)`;

export function morphCard(
  surface: HTMLElement,
  photo: HTMLElement,
  copy: HTMLElement,
  target: HTMLElement,
  from: CardMorphSource,
): Animation[] {
  const targetPhoto = target.querySelector<HTMLElement>('.detail-image');
  const to = target.getBoundingClientRect();
  const toPhoto = targetPhoto?.getBoundingClientRect();
  const toTitle = target
    .querySelector<HTMLElement>('h1')
    ?.getBoundingClientRect();
  if (
    !toPhoto ||
    !toTitle ||
    !to.width ||
    !to.height ||
    !toPhoto.width ||
    !toPhoto.height ||
    !from.card.width ||
    !from.card.height ||
    !surface.animate ||
    !photo.animate ||
    !copy.animate ||
    !target.animate
  )
    return [];

  Object.assign(surface.style, frame(to));
  Object.assign(photo.style, frame(toPhoto));
  Object.assign(copy.style, frame(from.copy));
  const options = { duration: 820, easing: 'linear' };
  const travelEase = 'cubic-bezier(.22,.8,.2,1)';
  const deltaX = toTitle.left - from.title.left;
  const deltaY = toTitle.top - from.title.top;
  const copyArrival = `translate(${deltaX}px, ${deltaY}px)`;
  const endClip = clipCopy(to, {
    left: from.copy.left + deltaX,
    top: from.copy.top + deltaY,
    width: from.copy.width,
    height: from.copy.height,
  });
  const arrival = {
    transform: 'translate(0, 0) scale(1, 1)',
    opacity: 1,
    borderRadius: 'var(--detail-radius)',
  };
  return [
    surface.animate(
      [
        {
          transform: `translate(${from.card.left - to.left}px, ${from.card.top - to.top}px) scale(${from.card.width / to.width}, ${from.card.height / to.height})`,
          opacity: 1,
          borderRadius: '14px',
          easing: travelEase,
        },
        { ...arrival, offset: 0.78 },
        { ...arrival, opacity: 0 },
      ],
      options,
    ),
    // Only this isolated photo frame resizes, preserving cover crop instead of stretching pixels or text.
    photo.animate(
      [
        {
          ...frame(from.photo),
          opacity: 1,
          borderRadius: '14px 14px 0 0',
          easing: travelEase,
        },
        {
          ...frame(toPhoto),
          opacity: 1,
          borderRadius: 'var(--detail-radius) var(--detail-radius) 0 0',
          offset: 0.78,
        },
        {
          ...frame(toPhoto),
          opacity: 0,
          borderRadius: 'var(--detail-radius) var(--detail-radius) 0 0',
        },
      ],
      options,
    ),
    target.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.78 }, { opacity: 1 }],
      options,
    ),
    copy.animate(
      [
        {
          transform: 'translate(0, 0)',
          opacity: 1,
          clipPath: clipCopy(from.card, from.copy),
          easing: travelEase,
        },
        { transform: copyArrival, opacity: 1, clipPath: endClip, offset: 0.78 },
        { transform: copyArrival, opacity: 0, clipPath: endClip },
      ],
      options,
    ),
  ];
}
