"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FaBars, FaTimes } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { useSearchPalette } from "@/components/search/SearchProvider";
import NotificationMenu from "@/components/navbar/NotificationMenu";
import ProfileMenu from "@/components/navbar/ProfileMenu";
import SearchTrigger from "@/components/navbar/SearchTrigger";
import { cn } from "@/lib/cn";

/**
 * The top bar.
 *
 * Height is fixed at 56px and must stay there: `sticky top-14` on the series and
 * details toolbars, and the `h-14` spacers on the home and series pages, are all
 * measured against it. A taller bar does not push those down, it covers them.
 *
 * Two states rather than one. Over a billboard the bar is a gradient scrim so
 * the artwork runs to the top of the window; once the page has scrolled it
 * becomes an opaque frosted strip, because there is no longer a hero behind it
 * to be transparent over and text was crossing text.
 */

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Series" },
  { href: "/mylist", label: "My List" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { openSearch } = useSearchPalette();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A route change with the drawer still open leaves it covering the page it
  // just navigated to.
  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-white/[0.07] bg-nx-bg/85 backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-black/85 via-black/45 to-transparent"
      )}
    >
      <nav className="flex h-14 items-center gap-2 px-4 sm:gap-4 sm:px-6 md:px-12 2xl:px-16">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-nx-muted transition hover:bg-white/[0.06] hover:text-nx-ink focus:outline-none focus-visible:nx-focus md:hidden"
        >
          {mobileOpen ? <FaTimes /> : <FaBars />}
        </button>

        <Link
          href="/"
          aria-label="Nextream home"
          className="shrink-0 rounded focus:outline-none focus-visible:nx-focus"
        >
          <Logo />
        </Link>

        <ul className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-2 text-[13px] font-medium transition-colors focus:outline-none focus-visible:nx-focus",
                  isActive(link.href)
                    ? "text-nx-ink"
                    : "text-nx-muted hover:text-nx-ink"
                )}
              >
                {link.label}
                {/* The indicator is drawn, not implied by colour alone —
                    "slightly brighter grey" is not a state anyone can read. */}
                <span
                  className={cn(
                    "absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-nx-accent via-nx-violet to-nx-cyan transition-opacity duration-300",
                    isActive(link.href) ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <SearchTrigger className="w-9 justify-center px-0 lg:w-64 lg:justify-start lg:pl-3.5 lg:pr-2" />

          {user ? (
            <>
              {/* No token prop: the bell reads NotificationsProvider, which holds
                  one live stream for the whole app rather than one fetch per
                  dropdown open. */}
              <NotificationMenu />
              <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" aria-hidden />
              <ProfileMenu
                username={user.username}
                email={user.email}
                profilePic={user.profilePic}
                onLogout={logout}
              />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-nx-accent px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-nx-accent-soft focus:outline-none focus-visible:nx-focus"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile drawer. Rendered inside the header so it inherits the same
          stacking context and can never be painted under a page's hero. */}
      {mobileOpen && (
        <div className="border-t border-white/[0.07] bg-nx-bg/95 backdrop-blur-xl md:hidden">
          <ul className="px-3 py-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:nx-focus",
                    isActive(link.href)
                      ? "bg-white/[0.08] text-nx-ink"
                      : "text-nx-muted hover:bg-white/[0.05] hover:text-nx-ink"
                  )}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-nx-accent" aria-hidden />
                  )}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-white/[0.07] pt-2">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  openSearch();
                }}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-nx-muted transition hover:bg-white/[0.05] hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
              >
                Search
              </button>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

/**
 * Mark plus wordmark, rather than the mark alone.
 *
 * /logo.png is a square glyph, and on its own at 32px it was an unlabelled
 * squiggle sharing a row with four text links — nothing on the page said what
 * the product was called. Pairing the existing mark with type makes it a
 * lockup; the type is hidden on small screens where the row cannot afford it.
 */
function Logo() {
  return (
    <span className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt="Nextream"
        width={64}
        height={64}
        priority
        className="h-7 w-7 rounded-md object-contain"
      />
      <span className="hidden text-[15px] font-black tracking-tight text-nx-ink sm:block">
        NEXTREAM
      </span>
    </span>
  );
}
