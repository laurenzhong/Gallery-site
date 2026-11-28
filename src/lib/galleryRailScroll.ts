const PAGE_HANDOFF_SPEED = 0.9; // CSS pixels per millisecond
const WHEEL_HANDOFF_IDLE_MS = 180;

function dampPageTravel(distance: number, elapsed: number) {
  const interval = Math.max(8, Math.min(elapsed, 48));
  const comfortableTravel = PAGE_HANDOFF_SPEED * interval;
  // Slow input passes through nearly unchanged, while fast input approaches a steady pace.
  return distance / Math.hypot(1, distance / comfortableTravel);
}

export function enableVerticalGalleryScroll(rail: HTMLElement) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let gesture: { x: number; y: number; lastInputTime: number; mode?: "rail" | "page" } | undefined;
  let wheelHandoff: { direction: number; lastInputTime: number } | undefined;
  let wheelHandoffTimer = 0;
  let frame = 0;
  let lastFrameTime = 0;
  let targetLeft: number | undefined;
  let pendingPageTravel = 0;
  let easeWheel = false;

  function railEnd() {
    return Math.max(0, rail.scrollWidth - rail.clientWidth);
  }

  function railMovement(distance: number) {
    const end = railEnd();
    const position = Math.max(0, Math.min(end, targetLeft ?? rail.scrollLeft));
    const available = distance < 0 ? position : end - position;
    const travel = Math.sign(distance) * Math.min(Math.abs(distance), available);
    return { left: position + travel, travel, reachesEdge: Math.abs(distance) >= available };
  }

  function updateScroll(time: number) {
    frame = 0;
    const elapsed = lastFrameTime ? time - lastFrameTime : 12;
    const shouldEase = easeWheel && !reducedMotion.matches;
    const hasPageTravel = Math.abs(pendingPageTravel) >= 0.5;
    if (targetLeft !== undefined) {
      const target = Math.min(targetLeft, railEnd());
      const left = rail.scrollLeft;
      const distance = target - left;

      if (shouldEase && Math.abs(distance) > (hasPageTravel ? 4 : 1)) {
        const fraction = 1 - Math.exp(-elapsed / (hasPageTravel ? 16 : 35));
        rail.scrollLeft = left + Math.sign(distance) * Math.max(1, Math.abs(distance) * fraction);
        lastFrameTime = time;
        frame = requestAnimationFrame(updateScroll);
        return;
      }

      rail.scrollLeft = target;
      targetLeft = undefined;
    }

    if (hasPageTravel) {
      const travel = shouldEase
        ? dampPageTravel(pendingPageTravel * (1 - Math.exp(-elapsed / 30)), elapsed)
        : pendingPageTravel;
      const pixels = Math.sign(travel) * Math.max(1, Math.round(Math.abs(travel)));
      window.scrollBy({ top: pixels, behavior: "instant" });
      pendingPageTravel -= pixels;

      if (shouldEase && Math.sign(pendingPageTravel) === Math.sign(pixels) && Math.abs(pendingPageTravel) >= 0.5) {
        lastFrameTime = time;
        frame = requestAnimationFrame(updateScroll);
        return;
      }
    }
    lastFrameTime = 0;
    easeWheel = false;
  }

  function queueScroll(left: number | undefined, pageTravel: number, ease: boolean) {
    if (left === undefined && !pageTravel) return;
    if (left !== undefined) targetLeft = left;
    pendingPageTravel += pageTravel;
    easeWheel = ease;
    if (!frame) frame = requestAnimationFrame(updateScroll);
  }

  function cancelScroll() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrameTime = 0;
    targetLeft = undefined;
    pendingPageTravel = 0;
    easeWheel = false;
  }

  function wheelDistance(event: WheelEvent) {
    const mode = event.deltaMode;
    if (reducedMotion.matches || event.ctrlKey || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return 0;

    const unit = mode === WheelEvent.DOM_DELTA_LINE ? 16
      : mode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight
      : 1;
    return event.deltaY * unit;
  }

  function clearWheelHandoff() {
    wheelHandoff = undefined;
    window.clearTimeout(wheelHandoffTimer);
    wheelHandoffTimer = 0;
    window.removeEventListener("wheel", onWheelHandoff, true);
  }

  function refreshWheelHandoff() {
    window.clearTimeout(wheelHandoffTimer);
    // Keep the listener long enough to see wheel events queued behind a busy frame.
    wheelHandoffTimer = window.setTimeout(clearWheelHandoff, WHEEL_HANDOFF_IDLE_MS * 3);
  }

  function onWheelHandoff(event: WheelEvent) {
    if (!wheelHandoff) return;
    const distance = wheelDistance(event);
    if (!event.deltaX && !event.deltaY) return;
    const elapsed = event.timeStamp - wheelHandoff.lastInputTime;
    if (Math.sign(distance) !== wheelHandoff.direction || elapsed >= WHEEL_HANDOFF_IDLE_MS) {
      clearWheelHandoff();
      return;
    }

    wheelHandoff.lastInputTime = event.timeStamp;
    refreshWheelHandoff();
    if (!event.cancelable) return;
    event.preventDefault();
    queueScroll(undefined, dampPageTravel(distance, elapsed), true);
  }

  function onWheel(event: WheelEvent) {
    if (event.defaultPrevented || (!event.deltaX && !event.deltaY)) return;
    const distance = wheelDistance(event);
    if (!distance) {
      if (easeWheel) cancelScroll();
      return;
    }
    if (!event.cancelable) return;

    const { left, travel, reachesEdge } = railMovement(distance);
    if (!travel) return;

    event.preventDefault();
    if (pendingPageTravel * distance < 0) pendingPageTravel = 0;
    if (reachesEdge) {
      wheelHandoff = { direction: Math.sign(distance), lastInputTime: event.timeStamp };
      // The rail can slide out from under the pointer while this wheel gesture continues.
      window.addEventListener("wheel", onWheelHandoff, { capture: true, passive: false });
      refreshWheelHandoff();
    }
    const pageTravel = reachesEdge ? dampPageTravel(distance - travel, 16) : 0;
    queueScroll(left, pageTravel, true);
  }

  function onTouchStart(event: TouchEvent) {
    clearWheelHandoff();
    if (easeWheel) cancelScroll();
    const touch = event.touches[0];
    gesture = !reducedMotion.matches && event.touches.length === 1
      ? { x: touch.clientX, y: touch.clientY, lastInputTime: event.timeStamp }
      : undefined;
  }

  function onTouchMove(event: TouchEvent) {
    if (!gesture || event.touches.length !== 1 || !event.cancelable) return;

    const touch = event.touches[0];
    const distance = gesture.y - touch.clientY;
    if (!gesture.mode) {
      const horizontal = Math.abs(touch.clientX - gesture.x);
      if (Math.max(horizontal, Math.abs(distance)) < 4) return;
      if (horizontal >= Math.abs(distance)) {
        gesture = undefined;
        return;
      }
    }

    const movement = gesture.mode === "page" ? undefined : railMovement(distance);
    const travel = movement?.travel ?? 0;
    if (!gesture.mode && !travel) {
      gesture = undefined;
      return;
    }
    event.preventDefault();
    gesture.y = touch.clientY;

    const remainder = distance - travel;
    const pageTravel = dampPageTravel(remainder, event.timeStamp - gesture.lastInputTime);
    gesture.lastInputTime = event.timeStamp;
    gesture.mode = !movement || remainder ? "page" : "rail";
    queueScroll(movement?.left, pageTravel, false);
  }

  function clearGesture() {
    gesture = undefined;
  }

  rail.addEventListener("wheel", onWheel, { passive: false });
  rail.addEventListener("touchstart", onTouchStart, { passive: true });
  rail.addEventListener("touchmove", onTouchMove, { passive: false });
  rail.addEventListener("touchend", clearGesture);
  rail.addEventListener("touchcancel", clearGesture);

  return () => {
    clearWheelHandoff();
    cancelScroll();
    rail.removeEventListener("wheel", onWheel);
    rail.removeEventListener("touchstart", onTouchStart);
    rail.removeEventListener("touchmove", onTouchMove);
    rail.removeEventListener("touchend", clearGesture);
    rail.removeEventListener("touchcancel", clearGesture);
  };
}
