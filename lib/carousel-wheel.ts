export function bindCarouselScrollLock(target: EventTarget): () => void {
  const lock = (event: Event) => {
    if (event.cancelable && !(event as WheelEvent).ctrlKey)
      event.preventDefault();
  };
  target.addEventListener('wheel', lock, { passive: false });
  return () => target.removeEventListener('wheel', lock);
}

export function carouselWheelGesture() {
  let lastEvent = -Infinity;
  let lastMove = -Infinity;
  let lastDelta = 0;
  let lastAxis: 'x' | 'y' | null = null;
  let moved = false;
  let deltaX = 0;
  let deltaY = 0;
  let renewalAt: number | null = null;
  let renewalConfirmed = false;
  return (event: {
    timeStamp: number;
    deltaX: number;
    deltaY: number;
  }): -1 | 0 | 1 => {
    const axis = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? 'x' : 'y';
    const packet = axis === 'x' ? event.deltaX : event.deltaY;
    const magnitude = Math.abs(packet);
    const previous = Math.abs(lastDelta);
    const reversed = axis === lastAxis && packet * lastDelta < 0;
    if (event.timeStamp - lastEvent >= 250) {
      moved = false;
      deltaX = 0;
      deltaY = 0;
      renewalAt = null;
    }
    lastEvent = event.timeStamp;
    lastDelta = packet;
    lastAxis = axis;
    if (moved) {
      // A fresh finger stroke can begin before the previous inertial tail goes silent.
      if (
        event.timeStamp - lastMove < 220 ||
        !(magnitude >= Math.max(4, previous * 2) || (reversed && magnitude >= 18))
      ) return 0;
      moved = false;
      deltaX = 0;
      deltaY = 0;
      renewalAt = event.timeStamp;
      renewalConfirmed = false;
    } else if (renewalAt !== null) {
      if (
        event.timeStamp - renewalAt > 120 ||
        (!renewalConfirmed && magnitude < previous)
      ) {
        moved = true;
        renewalAt = null;
        return 0;
      }
      if (magnitude >= previous) renewalConfirmed = true;
    }
    deltaX += event.deltaX;
    deltaY += event.deltaY;
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    if (Math.abs(delta) < 18) return 0;
    moved = true;
    lastMove = event.timeStamp;
    renewalAt = null;
    return delta > 0 ? 1 : -1;
  };
}
