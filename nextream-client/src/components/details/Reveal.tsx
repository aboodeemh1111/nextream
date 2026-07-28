"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface RevealProps {
  children: React.ReactNode;
  /** Stagger within a group, in milliseconds. */
  delay?: number;
  /** Fraction of the element that must be on screen before it plays. */
  amount?: number;
  className?: string;
}

/**
 * Plays a section in as it scrolls into view, once.
 *
 * An observer rather than a scroll listener: the detail page stacks half a
 * dozen of these and a shared listener would run layout maths for all of them
 * on every frame of a flick scroll. Unobserves on the first intersection so a
 * section that leaves and re-enters does not replay — a panel that re-animates
 * every time it passes the fold reads as a glitch, not as polish.
 *
 * Falls back to visible wherever IntersectionObserver is missing, since the
 * resting state is opacity: 0 and nothing else would ever reveal it.
 */
export default function Reveal({
  children,
  delay = 0,
  amount = 0.15,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: amount, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);

  return (
    <div
      ref={ref}
      className={cn("nx-reveal", shown && "nx-reveal-in", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
