"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import {
  FaEdit,
  FaTrash,
  FaArrowLeft,
  FaUser,
  FaEnvelope,
  FaCalendar,
  FaClock,
  FaShieldAlt,
  FaList,
  FaHeart,
  FaBookmark,
  FaPlay,
  FaFilm,
  FaCheckCircle,
  FaSpinner,
  FaTv,
  FaChartLine,
} from "react-icons/fa";
import UserAnalyticsPanel, {
  formatDuration,
  type UserAnalytics,
} from "@/components/users/UserAnalyticsPanel";

interface SubscriptionStatus {
  plan?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}

interface MovieRef {
  _id: string;
  title: string;
  img?: string;
  imgSm?: string;
  poster?: string;
  year?: string;
  genre?: string;
  isSeries?: boolean;
  duration?: string;
}

interface WatchEntry {
  movie?: MovieRef | string | null;
  watchedAt?: string;
  lastWatchedAt?: string;
  progress?: number;
  completed?: boolean;
  watchTime?: number;
  dropOffPoint?: number;
  rewatchCount?: number;
}

interface ProfileUser {
  _id: string;
  username: string;
  email: string;
  profilePic?: string;
  isAdmin: boolean;
  createdAt: string;
  lastLoginDate?: string;
  totalWatchTime?: number;
  myList?: (MovieRef | string)[];
  myShows?: (MovieRef | string)[];
  favorites?: (MovieRef | string)[];
  watchlist?: (MovieRef | string)[];
  watchHistory?: WatchEntry[];
  currentlyWatching?: WatchEntry[];
  subscriptionStatus?: SubscriptionStatus;
}

type LibraryTab = "myList" | "favorites" | "watchlist" | "history" | "watching";
type ActivityTab = LibraryTab | "overview";

const formatWatchTime = formatDuration;

function isMovieRef(item: MovieRef | string | null | undefined): item is MovieRef {
  return Boolean(item && typeof item === "object" && "_id" in item);
}

function moviePoster(movie: MovieRef): string | undefined {
  return movie.imgSm || movie.img || movie.poster || undefined;
}

function MovieCard({ movie }: { movie: MovieRef }) {
  const poster = moviePoster(movie);

  return (
    <Link
      href={`/movies/${movie._id}`}
      className="group flex gap-3 p-3 rounded-lg border border-border bg-background hover:border-red-300 hover:shadow-sm transition"
    >
      <div className="relative h-20 w-14 shrink-0 rounded-md overflow-hidden bg-muted">
        {poster ? (
          <Image
            src={poster}
            alt={movie.title}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <FaFilm className="text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground group-hover:text-red-600 truncate">
          {movie.title}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {movie.year && <span>{movie.year}</span>}
          {movie.genre && <span>{movie.genre}</span>}
          {movie.duration && <span>{movie.duration}</span>}
          {typeof movie.isSeries === "boolean" && (
            <span>{movie.isSeries ? "Series" : "Movie"}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function WatchHistoryCard({ entry }: { entry: WatchEntry }) {
  if (!isMovieRef(entry.movie)) {
    return (
      <div className="p-3 rounded-lg border border-border bg-background text-sm text-muted-foreground">
        Title unavailable
      </div>
    );
  }

  const movie = entry.movie;
  const poster = moviePoster(movie);
  const progress = Math.min(Math.max(entry.progress ?? 0, 0), 100);

  return (
    <Link
      href={`/movies/${movie._id}`}
      className="group block p-3 rounded-lg border border-border bg-background hover:border-red-300 hover:shadow-sm transition"
    >
      <div className="flex gap-3">
        <div className="relative h-20 w-14 shrink-0 rounded-md overflow-hidden bg-muted">
          {poster ? (
            <Image
              src={poster}
              alt={movie.title}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <FaFilm className="text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground group-hover:text-red-600 truncate">
            {movie.title}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {entry.watchedAt && (
              <span>
                Watched{" "}
                {new Date(entry.watchedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {typeof entry.watchTime === "number" && entry.watchTime > 0 && (
              <span>{formatWatchTime(entry.watchTime)}</span>
            )}
            {typeof entry.rewatchCount === "number" &&
              entry.rewatchCount > 0 && (
                <span>{entry.rewatchCount} rewatch</span>
              )}
            {entry.completed ? (
              <span className="inline-flex items-center text-green-700">
                <FaCheckCircle className="mr-1" /> Completed
              </span>
            ) : (
              <span>{progress}% watched</span>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${
                entry.completed ? "bg-green-500" : "bg-red-500"
              }`}
              style={{ width: `${entry.completed ? 100 : progress}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-muted-foreground border border-dashed border-border rounded-lg">
      <FaFilm className="mx-auto text-3xl mb-2 opacity-40" />
      <p className="text-sm">No {label} yet</p>
    </div>
  );
}

export default function UserProfilePage() {
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActivityTab>("overview");
  const params = useParams();
  const userId = params.id as string;
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const res = await api.get(`/users/find/${userId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setProfileUser(res.data);
      } catch (err) {
        setError("Failed to load user data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, user]);

  // Separate from the profile fetch so changing the window re-queries only the
  // aggregations, and so a failing analytics call still leaves a usable page.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const res = await api.get(`/users/${userId}/analytics`, {
          params: {
            days,
            // Bucket days in the admin's own zone; a UTC-bucketed chart shifts
            // every evening's viewing into the wrong day for most of the world.
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          headers: { token: `Bearer ${user.accessToken}` },
        });
        if (cancelled) return;
        setAnalytics(res.data);
        setAnalyticsError(null);
      } catch (err) {
        if (cancelled) return;
        setAnalyticsError("Analytics are unavailable for this user right now.");
        console.error(err);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
    return () => {
      cancelled = true;
    };
  }, [userId, user, days]);

  const handleDelete = async () => {
    if (!user || !profileUser) return;

    if (
      window.confirm(
        `Are you sure you want to delete "${profileUser.username}"?`
      )
    ) {
      try {
        await api.delete(`/users/${userId}`, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        router.push("/users");
      } catch (err) {
        console.error(err);
        alert("Failed to delete user");
      }
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !profileUser) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6"
            role="alert"
          >
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline">
              {" "}
              {error || "User not found"}
            </span>
          </div>
          <Link
            href="/users"
            className="text-blue-600 hover:underline flex items-center"
          >
            <FaArrowLeft className="mr-2" /> Back to Users
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const subscription = profileUser.subscriptionStatus;
  const myList = (profileUser.myList || []).filter(isMovieRef);
  const myShows = (profileUser.myShows || []).filter(isMovieRef);
  const favorites = (profileUser.favorites || []).filter(isMovieRef);
  const watchlist = (profileUser.watchlist || []).filter(isMovieRef);
  const watchHistory = [...(profileUser.watchHistory || [])].sort((a, b) => {
    const aTime = a.watchedAt ? new Date(a.watchedAt).getTime() : 0;
    const bTime = b.watchedAt ? new Date(b.watchedAt).getTime() : 0;
    return bTime - aTime;
  });
  const currentlyWatching = [...(profileUser.currentlyWatching || [])].sort(
    (a, b) => {
      const aTime = a.lastWatchedAt
        ? new Date(a.lastWatchedAt).getTime()
        : 0;
      const bTime = b.lastWatchedAt
        ? new Date(b.lastWatchedAt).getTime()
        : 0;
      return bTime - aTime;
    }
  );

  const historyWatchTime = watchHistory.reduce(
    (sum, entry) => sum + (entry.watchTime || 0),
    0
  );

  // Measured sessions first. The other two are pre-telemetry counters kept
  // only so an older account does not read as "never watched anything".
  const totalWatchSeconds =
    analytics?.totals.watchSeconds ||
    profileUser.totalWatchTime ||
    historyWatchTime;

  const tabs: {
    id: LibraryTab;
    label: string;
    icon: ReactNode;
    count: number;
  }[] = [
    {
      id: "myList",
      label: "My List",
      icon: <FaList />,
      count: myList.length + myShows.length,
    },
    {
      id: "favorites",
      label: "Favorites",
      icon: <FaHeart />,
      count: favorites.length,
    },
    {
      id: "watchlist",
      label: "Watchlist",
      icon: <FaBookmark />,
      count: watchlist.length,
    },
    {
      id: "history",
      label: "Watch History",
      icon: <FaClock />,
      count: watchHistory.length,
    },
    {
      id: "watching",
      label: "In Progress",
      icon: <FaSpinner />,
      count: currentlyWatching.length,
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/users"
            className="text-blue-600 hover:underline flex items-center"
          >
            <FaArrowLeft className="mr-2" /> Back to Users
          </Link>

          <div className="flex space-x-4">
            <Link
              href={`/users/edit/${userId}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <FaEdit className="mr-2" /> Edit
            </Link>
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <FaTrash className="mr-2" /> Delete
            </button>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border mb-6">
          <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              <div className="h-24 w-24 rounded-full bg-white/20 border-4 border-white/40 overflow-hidden flex items-center justify-center shrink-0">
                {profileUser.profilePic ? (
                  <Image
                    src={profileUser.profilePic}
                    alt={profileUser.username}
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FaUser className="text-white text-4xl" />
                )}
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {profileUser.username}
                </h1>
                <span
                  className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                    profileUser.isAdmin
                      ? "bg-white text-red-700"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {profileUser.isAdmin ? "Admin" : "User"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <h2 className="text-xl font-semibold mb-4">Account Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-background border border-border">
                    <FaEnvelope className="text-red-600 mt-1 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Email
                      </p>
                      <p className="text-sm font-medium text-foreground break-all">
                        {profileUser.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-lg bg-background border border-border">
                    <FaShieldAlt className="text-red-600 mt-1 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Role
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {profileUser.isAdmin ? "Administrator" : "Regular User"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-lg bg-background border border-border">
                    <FaCalendar className="text-red-600 mt-1 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Joined
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(profileUser.createdAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-lg bg-background border border-border">
                    <FaClock className="text-red-600 mt-1 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Last Login
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {profileUser.lastLoginDate
                          ? new Date(
                              profileUser.lastLoginDate
                            ).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : "Never"}
                      </p>
                    </div>
                  </div>

                  {subscription && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-background border border-border sm:col-span-2">
                      <FaPlay className="text-red-600 mt-1 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Subscription
                        </p>
                        <p className="text-sm font-medium text-foreground capitalize">
                          {subscription.plan || "basic"}
                          <span
                            className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                              subscription.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {subscription.isActive ? "Active" : "Inactive"}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Activity Summary</h2>
                <div className="space-y-3">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border transition text-left ${
                        activeTab === tab.id
                          ? "border-red-500 bg-red-50"
                          : "border-border bg-background hover:border-red-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-red-600">{tab.icon}</span>
                        <span className="text-sm text-muted-foreground">
                          {tab.label}
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-foreground">
                        {tab.id === "history"
                          ? formatWatchTime(totalWatchSeconds)
                          : tab.count}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Watch History shows measured watch time across movies and TV.
                  Open Overview for the full breakdown.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-md border border-border overflow-hidden">
          <div className="border-b border-border px-4 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === "overview"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FaChartLine />
                Overview
              </button>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === tab.id
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab.id
                        ? "bg-red-100 text-red-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <>
                {analytics ? (
                  <UserAnalyticsPanel
                    analytics={analytics}
                    days={days}
                    onDaysChange={setDays}
                    loading={analyticsLoading}
                  />
                ) : analyticsLoading ? (
                  <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600" />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                    {analyticsError || "No analytics available."}
                  </div>
                )}
              </>
            )}

            {activeTab === "myList" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">My List</h2>
                  <span className="text-sm text-muted-foreground">
                    {myList.length} movies
                    {myShows.length > 0 ? ` · ${myShows.length} shows` : ""}
                  </span>
                </div>
                {myList.length === 0 && myShows.length === 0 ? (
                  <EmptyState label="items in My List" />
                ) : (
                  <div className="space-y-6">
                    {myList.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <FaFilm /> Movies
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {myList.map((movie) => (
                            <MovieCard key={movie._id} movie={movie} />
                          ))}
                        </div>
                      </div>
                    )}
                    {myShows.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <FaTv /> TV Shows
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {myShows.map((show) => (
                            <div
                              key={show._id}
                              className="flex gap-3 p-3 rounded-lg border border-border bg-background"
                            >
                              <div className="relative h-20 w-14 shrink-0 rounded-md overflow-hidden bg-muted">
                                {moviePoster(show) ? (
                                  <Image
                                    src={moviePoster(show)!}
                                    alt={show.title}
                                    fill
                                    className="object-cover"
                                    sizes="56px"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center">
                                    <FaTv className="text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {show.title}
                                </p>
                                {show.year && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {show.year}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "favorites" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Favorites</h2>
                  <span className="text-sm text-muted-foreground">
                    {favorites.length} titles
                  </span>
                </div>
                {favorites.length === 0 ? (
                  <EmptyState label="favorites" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {favorites.map((movie) => (
                      <MovieCard key={movie._id} movie={movie} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "watchlist" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Watchlist</h2>
                  <span className="text-sm text-muted-foreground">
                    {watchlist.length} titles
                  </span>
                </div>
                {watchlist.length === 0 ? (
                  <EmptyState label="watchlist items" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {watchlist.map((movie) => (
                      <MovieCard key={movie._id} movie={movie} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <h2 className="text-lg font-semibold">Watch History</h2>
                  <div className="text-sm text-muted-foreground">
                    {watchHistory.length} titles ·{" "}
                    {formatWatchTime(
                      profileUser.totalWatchTime || historyWatchTime
                    )}{" "}
                    total
                  </div>
                </div>
                {watchHistory.length === 0 ? (
                  <EmptyState label="watch history" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {watchHistory.map((entry, index) => (
                      <WatchHistoryCard
                        key={
                          isMovieRef(entry.movie)
                            ? `${entry.movie._id}-${entry.watchedAt || index}`
                            : `history-${index}`
                        }
                        entry={entry}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "watching" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Currently Watching</h2>
                  <span className="text-sm text-muted-foreground">
                    {currentlyWatching.length} in progress
                  </span>
                </div>
                {currentlyWatching.length === 0 ? (
                  <EmptyState label="in-progress titles" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {currentlyWatching.map((entry, index) => (
                      <WatchHistoryCard
                        key={
                          isMovieRef(entry.movie)
                            ? `watching-${entry.movie._id}`
                            : `watching-${index}`
                        }
                        entry={{
                          ...entry,
                          watchedAt: entry.lastWatchedAt,
                          completed: false,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
