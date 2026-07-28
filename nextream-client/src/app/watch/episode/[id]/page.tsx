"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FaArrowLeft,
  FaClosedCaptioning,
  FaCog,
  FaCompress,
  FaExclamationTriangle,
  FaExpand,
  FaList,
  FaPause,
  FaPlay,
  FaStepBackward,
  FaStepForward,
  FaTimes,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { MdReplay10, MdForward10, MdPictureInPictureAlt } from "react-icons/md";
import EpisodeList from "@/components/series/EpisodeList";
import { Spinner } from "@/components/series/Bits";
import { useAuth } from "@/context/AuthContext";
import {
  EpisodePage,
  episodeCode,
  formatTimecode,
  showBackdrop,
  tv,
} from "@/lib/tv";
import { cn } from "@/lib/cn";

/** How often playback position is written back while the episode is playing. */
const PROGRESS_INTERVAL_MS = 10_000;
/** Remaining seconds at which the next-episode card appears. */
const UP_NEXT_AT_SEC = 15;
/** Idle time before the chrome fades out. */
const CONTROLS_IDLE_MS = 3000;

function EpisodePlayer() {
  const { id } = useParams();
  const episodeId = Array.isArray(id) ? id[0] : id || "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<EpisodePage | null>(null);
  const [loading, setLoading] = useState(true);
  // Two distinct failures. `error` means the episode itself could not be
  // fetched, so there is nothing to show. `playbackError` means the media
  // failed — the episode, its controls and its drawer are all still valid, and
  // tearing them down would strand the viewer on a dead page when switching
  // quality or skipping to the next episode would have fixed it.
  const [error, setError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

  const [qualityIndex, setQualityIndex] = useState(0);
  const [menu, setMenu] = useState<"none" | "quality" | "subtitles">("none");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [subtitleUrls, setSubtitleUrls] = useState<Record<string, string>>({});
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);

  const [upNextIn, setUpNextIn] = useState<number | null>(null);
  const [upNextDismissed, setUpNextDismissed] = useState(false);

  const episode = data?.episode ?? null;
  const sources = useMemo(() => episode?.videoSources || [], [episode]);
  const activeSource = sources[qualityIndex] || sources[0] || null;

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const ready = !authLoading && Boolean(user);

  // --- load -----------------------------------------------------------------

  useEffect(() => {
    if (!ready || !episodeId) return;
    let cancelled = false;

    setLoading(true);
    // A fresh episode resets everything that describes the previous one.
    setUpNextIn(null);
    setUpNextDismissed(false);
    setQualityIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);

    tv.episode(episodeId)
      .then((page) => {
        if (cancelled) return;
        setData(page);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.status === 404
            ? "This episode isn't available."
            : "We couldn't load this episode."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, episodeId]);

  // Seek to wherever the viewer left off. `?t=` wins over the stored position:
  // it is what the card they clicked promised, and it is already on screen.
  const resumeTarget = useMemo(() => {
    const fromUrl = Number(searchParams.get("t"));
    if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;
    return data?.resumeSec || 0;
  }, [searchParams, data?.resumeSec]);

  const appliedResumeFor = useRef<string | null>(null);
  /** Position to restore after a quality switch swaps the source element. */
  const pendingSeekRef = useRef<number | null>(null);

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration || 0);

    if (pendingSeekRef.current !== null) {
      video.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    } else if (appliedResumeFor.current !== episodeId && resumeTarget > 0) {
      // Once per episode: a quality switch fires loadedmetadata too, and
      // re-seeking there would throw the viewer back to the resume point.
      appliedResumeFor.current = episodeId;
      if (!video.duration || resumeTarget < video.duration - 5) {
        video.currentTime = resumeTarget;
      }
    }
    video.play().catch(() => setPlaying(false));
  };

  // --- progress -------------------------------------------------------------

  const saveProgress = useCallback(
    (completed?: boolean) => {
      const video = videoRef.current;
      if (!video || !episode || !video.duration || !Number.isFinite(video.duration)) {
        return;
      }
      tv
        .saveProgress({
          episodeId: episode._id,
          positionSec: video.currentTime,
          durationSec: video.duration,
          completed,
        })
        .catch(() => {
          // Progress is best-effort; a failed ping must never interrupt playback.
        });
    },
    [episode]
  );

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => saveProgress(), PROGRESS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, saveProgress]);

  // Closing the tab or backgrounding it are the two most common ways to stop
  // watching, and neither fires `pause`.
  useEffect(() => {
    const flush = () => saveProgress();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [saveProgress]);

  // --- playback controls ----------------------------------------------------

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => setPlaying(false));
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
  }, []);

  const seekTo = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }, []);

  const changeVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, value));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch {
      // Denied by the browser (iOS Safari on non-video elements); nothing to do.
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      // Unsupported or blocked; the button simply does nothing.
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // --- quality --------------------------------------------------------------

  // Changing source remounts the <video>, so the position has to be carried
  // over by hand or every quality switch restarts the episode. Handing it to
  // onLoadedMetadata via a ref avoids racing a listener attached after the
  // event has already fired for a cached source.
  const changeQuality = useCallback((index: number) => {
    pendingSeekRef.current = videoRef.current?.currentTime ?? 0;
    setQualityIndex(index);
    setPlaybackError(null);
    setMenu("none");
  }, []);

  /** Re-mounts the <video> on the same source, keeping the current position. */
  const retryPlayback = useCallback(() => {
    pendingSeekRef.current = videoRef.current?.currentTime ?? currentTime;
    setPlaybackError(null);
    setReloadToken((token) => token + 1);
  }, [currentTime]);

  const describeMediaError = (code?: number) => {
    switch (code) {
      case 2:
        return "The connection dropped while loading this episode.";
      case 3:
        return "This episode's video could not be decoded.";
      case 4:
        return "This episode's video is unavailable or in an unsupported format.";
      default:
        return "This episode failed to play.";
    }
  };

  // --- subtitles ------------------------------------------------------------

  /**
   * Subtitle files are fetched and re-served as blob URLs rather than pointed
   * at directly. A cross-origin <track> forces crossOrigin="anonymous" on the
   * <video>, which would make the *video* fail whenever the bucket's CORS
   * headers are missing — trading a missing caption track for a dead player.
   */
  const selectSubtitle = useCallback(
    async (lang: string | null) => {
      setMenu("none");
      if (!lang) {
        setActiveSubtitle(null);
        return;
      }
      if (!subtitleUrls[lang]) {
        const track = episode?.subtitles?.find((entry) => entry.lang === lang);
        if (!track) return;
        try {
          const response = await fetch(track.url);
          if (!response.ok) throw new Error(String(response.status));
          const blobUrl = URL.createObjectURL(
            new Blob([await response.text()], { type: "text/vtt" })
          );
          setSubtitleUrls((prev) => ({ ...prev, [lang]: blobUrl }));
        } catch {
          return; // leave captions off rather than showing a broken toggle
        }
      }
      setActiveSubtitle(lang);
    },
    [episode, subtitleUrls]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (const track of Array.from(video.textTracks)) {
      track.mode = activeSubtitle && track.language === activeSubtitle ? "showing" : "disabled";
    }
  }, [activeSubtitle, subtitleUrls, activeSource?.url]);

  useEffect(
    () => () => {
      for (const url of Object.values(subtitleUrls)) URL.revokeObjectURL(url);
    },
    [subtitleUrls]
  );

  // --- up next --------------------------------------------------------------

  const goToNext = useCallback(() => {
    if (!data?.next) return;
    saveProgress(true);
    router.push(`/watch/episode/${data.next._id}`);
  }, [data?.next, router, saveProgress]);

  useEffect(() => {
    if (upNextIn === null) return;
    if (upNextIn <= 0) {
      goToNext();
      return;
    }
    const timer = setTimeout(() => setUpNextIn((value) => (value ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [upNextIn, goToNext]);

  // --- chrome auto-hide -----------------------------------------------------

  useEffect(() => {
    if (!playing || drawerOpen || menu !== "none") {
      setChromeVisible(true);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setChromeVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setChromeVisible(false), CONTROLS_IDLE_MS);
    };

    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [playing, drawerOpen, menu]);

  // --- keyboard -------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never hijack a key the viewer meant for a field or a menu button.
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
          event.preventDefault();
          seekBy(-10);
          break;
        case "arrowright":
          event.preventDefault();
          seekBy(10);
          break;
        case "arrowup":
          event.preventDefault();
          changeVolume(volume + 0.1);
          break;
        case "arrowdown":
          event.preventDefault();
          changeVolume(volume - 0.1);
          break;
        case "m":
          changeVolume(muted ? 1 : 0);
          break;
        case "f":
          toggleFullscreen();
          break;
        case "c":
          selectSubtitle(
            activeSubtitle ? null : episode?.subtitles?.[0]?.lang || null
          );
          break;
        case "n":
          goToNext();
          break;
        case "escape":
          setDrawerOpen(false);
          setMenu("none");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    togglePlay,
    seekBy,
    changeVolume,
    toggleFullscreen,
    selectSubtitle,
    goToNext,
    volume,
    muted,
    activeSubtitle,
    episode,
  ]);

  // --- render ---------------------------------------------------------------

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-nx-black">
        <Spinner className="h-8 w-8" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-nx-black px-4 text-center text-nx-ink">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-nx-surface text-nx-accent">
          <FaExclamationTriangle />
        </span>
        <p className="text-lg font-semibold">{error || "Episode not found"}</p>
        <Link
          href="/series"
          className="mt-6 rounded-md bg-nx-ink px-5 py-2 text-sm font-semibold text-nx-black transition hover:bg-white"
        >
          Back to Series
        </Link>
      </main>
    );
  }

  const { show, next, prev, seasonEpisodes } = data;
  const playedPercent = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration ? (buffered / duration) * 100 : 0;
  const showUpNext = upNextIn !== null && Boolean(next);

  return (
    <main
      ref={shellRef}
      className={cn(
        "relative flex h-screen w-screen flex-col overflow-hidden bg-nx-black text-nx-ink",
        !chromeVisible && "cursor-none"
      )}
    >
      {activeSource ? (
        <video
          key={`${activeSource.url}#${reloadToken}`}
          ref={videoRef}
          src={activeSource.url}
          poster={episode?.stillPath || showBackdrop(show)}
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full bg-black object-contain"
          // A tap with a menu open should dismiss it, not also pause playback.
          onClick={() => (menu === "none" ? togglePlay() : setMenu("none"))}
          onDoubleClick={toggleFullscreen}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            saveProgress();
          }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            setCurrentTime(video.currentTime);
            if (video.buffered.length) {
              setBuffered(video.buffered.end(video.buffered.length - 1));
            }
            const remaining = (video.duration || 0) - video.currentTime;
            if (
              next &&
              !upNextDismissed &&
              upNextIn === null &&
              video.duration &&
              remaining <= UP_NEXT_AT_SEC
            ) {
              setUpNextIn(Math.max(1, Math.round(remaining)));
            }
          }}
          onEnded={() => {
            saveProgress(true);
            if (next && !upNextDismissed) goToNext();
          }}
          onError={(event) => {
            setPlaybackError(describeMediaError(event.currentTarget.error?.code));
            setWaiting(false);
            setPlaying(false);
          }}
        >
          {Object.entries(subtitleUrls).map(([lang, url]) => (
            <track
              key={lang}
              kind="subtitles"
              src={url}
              srcLang={lang}
              label={lang.toUpperCase()}
            />
          ))}
        </video>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-nx-black text-center">
          <FaExclamationTriangle className="text-2xl text-nx-accent" />
          <p className="text-sm text-nx-muted">
            No video source has been uploaded for this episode yet.
          </p>
        </div>
      )}

      {waiting && !playbackError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner className="h-10 w-10" />
        </div>
      )}

      {/* Recoverable: the controls, the episode drawer and the next-episode
          link all stay live behind this. */}
      {playbackError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-nx-black/85 px-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-nx-surface text-nx-accent">
            <FaExclamationTriangle />
          </span>
          <p className="max-w-sm text-sm text-nx-ink">{playbackError}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={retryPlayback}
              className="rounded-md bg-nx-ink px-4 py-2 text-sm font-semibold text-nx-black transition hover:bg-white"
            >
              Try again
            </button>
            {sources.length > 1 && (
              <button
                type="button"
                onClick={() => changeQuality((qualityIndex + 1) % sources.length)}
                className="rounded-md border border-nx-line px-4 py-2 text-sm font-semibold text-nx-ink transition hover:bg-white/10"
              >
                Try {sources[(qualityIndex + 1) % sources.length].label || "another source"}
              </button>
            )}
            {next && (
              <button
                type="button"
                onClick={goToNext}
                className="rounded-md border border-nx-line px-4 py-2 text-sm font-semibold text-nx-ink transition hover:bg-white/10"
              >
                Skip to next episode
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top chrome */}
      <div
        className={cn(
          "relative z-20 flex items-start gap-4 bg-gradient-to-b from-black/85 to-transparent p-4 transition-opacity duration-300 md:p-6",
          chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <Link
          href={`/series/${show._id}`}
          aria-label={`Back to ${show.title}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/50 text-nx-ink transition hover:bg-black/80"
        >
          <FaArrowLeft />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm text-nx-muted">{show.title}</p>
          <h1 className="truncate text-lg font-semibold md:text-xl">
            {episode && `${episodeCode(episode)} · ${episode.title}`}
          </h1>
        </div>
      </div>

      <div className="flex-1" />

      {/* Up next */}
      {showUpNext && next && (
        <div className="absolute bottom-28 right-4 z-30 w-72 rounded-xl border border-nx-line bg-nx-surface/95 p-4 shadow-2xl backdrop-blur md:right-8">
          <p className="text-xs uppercase tracking-wider text-nx-dim">Up next</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold">
            {episodeCode(next)} · {next.title}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={goToNext}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold text-black transition hover:bg-white/85"
            >
              <FaPlay className="text-xs" /> Play now ({upNextIn})
            </button>
            <button
              type="button"
              onClick={() => {
                setUpNextIn(null);
                setUpNextDismissed(true);
              }}
              aria-label="Dismiss up next"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-nx-line text-nx-muted transition hover:text-nx-ink"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      {/* Bottom chrome */}
      <div
        className={cn(
          "relative z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-10 transition-opacity duration-300 md:px-6",
          chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        {/* Scrubber: painted layers for the visuals, a real range input on top
            so keyboard and screen-reader users get a working control. */}
        <div className="group/seek relative flex h-6 items-center">
          <div className="absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/25 transition-all group-hover/seek:h-1.5">
            <div
              className="absolute inset-y-0 left-0 bg-white/35"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-nx-accent"
              style={{ width: `${playedPercent}%` }}
            />
          </div>
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-nx-accent opacity-0 transition group-hover/seek:opacity-100"
            style={{ left: `${playedPercent}%` }}
            aria-hidden
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={currentTime}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label="Seek"
            className="relative h-6 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>

        <div className="mt-1 flex items-center gap-2 md:gap-4">
          <ControlButton onClick={togglePlay} label={playing ? "Pause" : "Play"}>
            {playing ? <FaPause /> : <FaPlay />}
          </ControlButton>

          <ControlButton onClick={() => seekBy(-10)} label="Back 10 seconds">
            <MdReplay10 className="text-2xl" />
          </ControlButton>

          <ControlButton onClick={() => seekBy(10)} label="Forward 10 seconds">
            <MdForward10 className="text-2xl" />
          </ControlButton>

          <div className="group/vol flex items-center gap-2">
            <ControlButton
              onClick={() => changeVolume(muted || volume === 0 ? 1 : 0)}
              label={muted || volume === 0 ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100"
            />
          </div>

          <span className="ml-1 shrink-0 text-xs tabular-nums text-nx-muted md:text-sm">
            {formatTimecode(currentTime)} / {formatTimecode(duration)}
          </span>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            {prev && (
              <Link
                href={`/watch/episode/${prev._id}`}
                title={`Previous: ${prev.title}`}
                aria-label={`Previous episode: ${prev.title}`}
                className="hidden h-9 w-9 items-center justify-center rounded-full text-nx-ink transition hover:bg-white/15 sm:inline-flex"
              >
                <FaStepBackward />
              </Link>
            )}

            {next && (
              <ControlButton onClick={goToNext} label={`Next episode: ${next.title}`}>
                <FaStepForward />
              </ControlButton>
            )}

            <ControlButton
              onClick={() => setDrawerOpen((open) => !open)}
              label="Episodes"
              active={drawerOpen}
            >
              <FaList />
            </ControlButton>

            {Boolean(episode?.subtitles?.length) && (
              <div className="relative">
                <ControlButton
                  onClick={() => setMenu(menu === "subtitles" ? "none" : "subtitles")}
                  label="Subtitles"
                  active={Boolean(activeSubtitle)}
                >
                  <FaClosedCaptioning />
                </ControlButton>
                {menu === "subtitles" && (
                  <Menu>
                    <MenuItem
                      selected={!activeSubtitle}
                      onClick={() => selectSubtitle(null)}
                    >
                      Off
                    </MenuItem>
                    {episode!.subtitles!.map((track) => (
                      <MenuItem
                        key={track.lang}
                        selected={activeSubtitle === track.lang}
                        onClick={() => selectSubtitle(track.lang)}
                      >
                        {track.lang.toUpperCase()}
                      </MenuItem>
                    ))}
                  </Menu>
                )}
              </div>
            )}

            {sources.length > 1 && (
              <div className="relative">
                <ControlButton
                  onClick={() => setMenu(menu === "quality" ? "none" : "quality")}
                  label="Quality"
                  active={menu === "quality"}
                >
                  <FaCog />
                </ControlButton>
                {menu === "quality" && (
                  <Menu>
                    {sources.map((source, index) => (
                      <MenuItem
                        key={`${source.label}-${index}`}
                        selected={index === qualityIndex}
                        onClick={() => changeQuality(index)}
                      >
                        {source.label || `Source ${index + 1}`}
                      </MenuItem>
                    ))}
                  </Menu>
                )}
              </div>
            )}

            <ControlButton onClick={togglePip} label="Picture in picture">
              <MdPictureInPictureAlt className="text-xl" />
            </ControlButton>

            <ControlButton
              onClick={toggleFullscreen}
              label={fullscreen ? "Exit full screen" : "Full screen"}
            >
              {fullscreen ? <FaCompress /> : <FaExpand />}
            </ControlButton>
          </div>
        </div>
      </div>

      {/* Episode drawer */}
      <aside
        aria-hidden={!drawerOpen}
        className={cn(
          "absolute inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-nx-line bg-nx-bg/97 backdrop-blur-xl transition-transform duration-300",
          drawerOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-nx-line px-4 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{show.title}</p>
            <p className="text-xs text-nx-muted">
              Season {episode?.seasonNumber} · {seasonEpisodes.length} episodes
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close episode list"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-nx-muted transition hover:bg-white/10 hover:text-nx-ink"
          >
            <FaTimes />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <EpisodeList
            episodes={seasonEpisodes}
            activeEpisodeId={episode?._id}
            fallbackStill={showBackdrop(show)}
          />
        </div>
      </aside>
    </main>
  );
}

function ControlButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-white/15",
        active ? "text-nx-cyan" : "text-nx-ink"
      )}
    >
      {children}
    </button>
  );
}

function Menu({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-11 right-0 min-w-[9rem] overflow-hidden rounded-lg border border-nx-line bg-nx-surface/97 py-1 shadow-2xl backdrop-blur">
      {children}
    </div>
  );
}

function MenuItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-white/10",
        selected ? "text-nx-cyan" : "text-nx-ink"
      )}
    >
      {children}
      {selected && <span aria-hidden>✓</span>}
    </button>
  );
}

export default function WatchEpisodePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-nx-black">
          <Spinner className="h-8 w-8" />
        </main>
      }
    >
      <EpisodePlayer />
    </Suspense>
  );
}
