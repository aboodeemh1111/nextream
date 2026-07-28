"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaCheck, FaPlus } from "react-icons/fa";
import { tv } from "@/lib/tv";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";
import { Spinner } from "./Bits";

interface MyListButtonProps {
  showId: string;
  inMyList?: boolean;
  /** Lets a parent row keep its copy of the show in sync with the toggle. */
  onChange?: (showId: string, inMyList: boolean) => void;
  variant?: "icon" | "full";
  className?: string;
}

/**
 * My List toggle.
 *
 * Optimistic: the icon flips immediately and rolls back if the request fails,
 * because on a card grid the round trip is long enough that a "pending" state
 * reads as an unresponsive button.
 */
export default function MyListButton({
  showId,
  inMyList = false,
  onChange,
  variant = "icon",
  className,
}: MyListButtonProps) {
  const [active, setActive] = useState(inMyList);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const toggle = async (event: React.MouseEvent) => {
    // These buttons live inside a card that is itself a link.
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }
    if (busy) return;

    const next = !active;
    setActive(next);
    setBusy(true);
    try {
      if (next) await tv.addToMyList(showId);
      else await tv.removeFromMyList(showId);
      onChange?.(showId, next);
    } catch {
      setActive(!next);
    } finally {
      setBusy(false);
    }
  };

  const label = active ? "Remove from My List" : "Add to My List";

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-nx-line bg-white/10 px-5 py-2.5 text-sm font-semibold text-nx-ink backdrop-blur transition hover:bg-white/20",
          className
        )}
      >
        {busy ? <Spinner /> : active ? <FaCheck /> : <FaPlus />}
        {active ? "In My List" : "My List"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/60 text-xs text-white transition hover:border-white hover:bg-black/80",
        active && "border-white bg-white text-black hover:bg-white",
        className
      )}
    >
      {busy ? <Spinner className="h-3 w-3" /> : active ? <FaCheck /> : <FaPlus />}
    </button>
  );
}
