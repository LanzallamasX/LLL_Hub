"use client";

import { useEffect, useState } from "react";

export type PresenceState = "open" | "closed";

/**
 * Keeps transient UI mounted briefly so its exit animation can finish.
 * The extra animation frame also guarantees that browsers paint the closed
 * state before transitioning to the open one.
 */
export function usePresence(visible: boolean, duration = 240) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [state, setState] = useState<PresenceState>("closed");

  useEffect(() => {
    let frame = 0;
    let transitionFrame = 0;
    let timer = 0;

    frame = window.requestAnimationFrame(() => {
      if (visible) {
        setShouldRender(true);
        setState("closed");
        transitionFrame = window.requestAnimationFrame(() => setState("open"));
      } else {
        setState("closed");
        timer = window.setTimeout(() => setShouldRender(false), duration);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(transitionFrame);
      window.clearTimeout(timer);
    };
  }, [visible, duration]);

  return { shouldRender, state } as const;
}
