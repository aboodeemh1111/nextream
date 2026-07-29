"use client";

import Link from "next/link";
import {
  FaBell,
  FaBookmark,
  FaHeart,
  FaHistory,
  FaPlayCircle,
  FaSignOutAlt,
  FaUser,
  FaUserEdit,
} from "react-icons/fa";
import { cn } from "@/lib/cn";
import Menu from "./Menu";

interface ProfileMenuProps {
  username: string;
  email?: string;
  profilePic?: string;
  onLogout: () => void;
}

/**
 * Links are grouped by what the viewer is trying to do — everything that is
 * "things I saved", then "who I am", then the way out. The old menu offered
 * Profile, Settings and Logout, and /settings has never been a route in this
 * app, so a third of it was a 404.
 */
const GROUPS = [
  [
    { href: "/mylist", label: "My List", icon: FaBookmark },
    { href: "/favorites", label: "Favourites", icon: FaHeart },
    { href: "/continue-watching", label: "Continue Watching", icon: FaPlayCircle },
    { href: "/watch-history", label: "Watch History", icon: FaHistory },
  ],
  [
    { href: "/profile", label: "Profile", icon: FaUser },
    { href: "/profile/edit", label: "Edit Profile", icon: FaUserEdit },
    { href: "/settings/notifications", label: "Notifications", icon: FaBell },
  ],
];

export default function ProfileMenu({
  username,
  email,
  profilePic,
  onLogout,
}: ProfileMenuProps) {
  return (
    <Menu
      label="Account menu"
      panelClassName="w-60"
      trigger={({ open }) => (
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-white/[0.06] transition-colors",
            open ? "border-white/40" : "border-white/10 hover:border-white/30"
          )}
        >
          {profilePic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profilePic}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-xs font-bold text-nx-ink">
              {initials(username)}
            </span>
          )}
        </span>
      )}
    >
      {({ close }) => (
        <>
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="truncate text-sm font-semibold text-nx-ink">{username}</p>
            {email && <p className="truncate text-[11px] text-nx-dim">{email}</p>}
          </div>

          {GROUPS.map((group, index) => (
            <div
              key={index}
              className={cn("py-1.5", index > 0 && "border-t border-white/[0.07]")}
            >
              {group.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-2 text-[13px] text-nx-muted transition hover:bg-white/[0.06] hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
                >
                  <link.icon className="text-[12px] text-nx-dim" aria-hidden />
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="border-t border-white/[0.07] py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onLogout();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-nx-muted transition hover:bg-white/[0.06] hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
            >
              <FaSignOutAlt className="text-[12px] text-nx-dim" aria-hidden />
              Sign out
            </button>
          </div>
        </>
      )}
    </Menu>
  );
}

/** Falls back to a monogram when there is no avatar to show. */
function initials(name: string): string {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
