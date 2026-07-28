"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaCheck, FaPlus } from "react-icons/fa";
import { MediaItem, setInMyList } from "@/lib/home";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/series/Bits";

interface ListButtonProps {
  item: MediaItem;
  /** Lets a parent row keep every copy of this title in sync with the toggle. */
  onChange?: (uid: string, inMyList: boolean) => void;
  variant?: "icon" | "full";
  /** Cards pass -1 while the hover panel is hidden, so Tab skips a control
   *  nobody can see. */
  tabIndex?: number;
  className?: string;
}

/**
 * My List toggle for either collection.
 *
 * Movies and shows are stored in different fields behind different endpoints;
 * `setInMyList` hides that, so this component only has to care about the
 * optimistic flip. Optimistic because the round trip is long enough on a card
 * grid that a pending state reads as an unresponsive button.
 */
export default function ListButton({
  item,
  onChange,
  variant = "icon",
  tabIndex,
  className,
}: ListButtonProps) {
  const [active, setActive] = useState(item.inMyList);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const toggle = async (event: React.MouseEvent) => {
    // These buttons sit inside a card that is itself a link.
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
      await setInMyList(item, next);
      onChange?.(item.uid, next);
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
        tabIndex={tabIndex}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-nx-ink backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:nx-focus",
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
      tabIndex={tabIndex}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/50 text-xs text-white transition hover:border-white hover:bg-black/80 focus:outline-none focus-visible:nx-focus",
        active && "border-white bg-white text-black hover:bg-white",
        className
      )}
    >
      {busy ? <Spinner className="h-3 w-3" /> : active ? <FaCheck /> : <FaPlus />}
    </button>
  );
}
