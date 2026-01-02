"use client";

import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import VideoUploader from "@/components/VideoUploader";

// Types
interface SeasonData {
  seasonNumber: number;
  name: string;
  poster: string;
  backdrop: string;
  published: boolean;
  episodes: EpisodeData[];
}

interface EpisodeData {
  episodeNumber: number;
  title: string;
  overview: string;
  videoUrl: string;
  stillPath: string;
  duration: number;
  published: boolean;
}

// Steps enum
const STEPS = {
  SHOW_DETAILS: 0,
  SEASONS: 1,
  EPISODES: 2,
  REVIEW: 3,
};

const STEP_LABELS = ["Show Details", "Seasons", "Episodes", "Review"];

export default function NewTVShowPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Show Details
  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [genres, setGenres] = useState("");
  const [published, setPublished] = useState(false);
  const [poster, setPoster] = useState("");
  const [backdrop, setBackdrop] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [slug, setSlug] = useState("");

  // Step 2 & 3: Seasons with Episodes
  const [seasons, setSeasons] = useState<SeasonData[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingProgress, setCreatingProgress] = useState("");
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());

  const isValidUrl = (u: string) => {
    try { if (!u) return true; new URL(u); return true; } catch { return false; }
  };

  // Validation
  const validateStep = (step: number): string | null => {
    switch (step) {
      case STEPS.SHOW_DETAILS:
        if (!title.trim()) return "Title is required";
        if (trailerUrl && !isValidUrl(trailerUrl)) return "Trailer URL is invalid";
        return null;
      case STEPS.SEASONS:
        return null; // Optional to have seasons
      case STEPS.EPISODES:
        return null; // Optional to have episodes
      default:
        return null;
    }
  };

  const handleNext = () => {
    const err = validateStep(currentStep);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setCurrentStep((s) => Math.min(s + 1, STEPS.REVIEW));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((s) => Math.max(s - 1, STEPS.SHOW_DETAILS));
  };

  // Season management
  const addSeason = () => {
    const nextNumber = seasons.length > 0
      ? Math.max(...seasons.map(s => s.seasonNumber)) + 1
      : 1;
    setSeasons([...seasons, {
      seasonNumber: nextNumber,
      name: `Season ${nextNumber}`,
      poster: "",
      backdrop: "",
      published: true,
      episodes: [],
    }]);
  };

  const removeSeason = (index: number) => {
    setSeasons(seasons.filter((_, i) => i !== index));
  };

  const updateSeason = (index: number, field: keyof SeasonData, value: any) => {
    setSeasons(seasons.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  // Episode management
  const addEpisode = (seasonIndex: number) => {
    const season = seasons[seasonIndex];
    const nextNumber = season.episodes.length > 0
      ? Math.max(...season.episodes.map(e => e.episodeNumber)) + 1
      : 1;
    const newEpisode: EpisodeData = {
      episodeNumber: nextNumber,
      title: `Episode ${nextNumber}`,
      overview: "",
      videoUrl: "",
      stillPath: "",
      duration: 0,
      published: true,
    };
    updateSeason(seasonIndex, 'episodes', [...season.episodes, newEpisode]);
    // Auto-expand the season when adding episode
    setExpandedSeasons(new Set([...expandedSeasons, seasonIndex]));
  };

  const removeEpisode = (seasonIndex: number, episodeIndex: number) => {
    const season = seasons[seasonIndex];
    updateSeason(seasonIndex, 'episodes', season.episodes.filter((_, i) => i !== episodeIndex));
  };

  const updateEpisode = (seasonIndex: number, episodeIndex: number, field: keyof EpisodeData, value: any) => {
    const season = seasons[seasonIndex];
    const updatedEpisodes = season.episodes.map((e, i) =>
      i === episodeIndex ? { ...e, [field]: value } : e
    );
    updateSeason(seasonIndex, 'episodes', updatedEpisodes);
  };

  const toggleSeasonExpand = (index: number) => {
    const newExpanded = new Set(expandedSeasons);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSeasons(newExpanded);
  };

  // Create everything
  const handleCreate = async () => {
    try {
      setLoading(true);
      setError(null);
      setCreatingProgress("Creating TV show...");

      // 1. Create the show
      const showPayload: any = {
        title,
        overview,
        genres: genres.split(",").map((g) => g.trim()).filter(Boolean),
        published,
        isSeries: true,
        poster,
        backdrop,
        trailerUrl,
      };
      if (slug.trim()) showPayload.slug = slug.trim().toLowerCase();

      const showRes = await api.post("/tv", showPayload);
      const showId = showRes.data._id;

      // 2. Create seasons and episodes
      for (let i = 0; i < seasons.length; i++) {
        const season = seasons[i];
        setCreatingProgress(`Creating Season ${season.seasonNumber}...`);

        const seasonRes = await api.post(`/tv/${showId}/seasons?auto=1`, {
          seasonNumber: season.seasonNumber,
          name: season.name || undefined,
          poster: season.poster || undefined,
          backdrop: season.backdrop || undefined,
          published: season.published,
        });
        const seasonId = seasonRes.data._id;

        // Create episodes for this season
        for (let j = 0; j < season.episodes.length; j++) {
          const ep = season.episodes[j];
          setCreatingProgress(`Creating S${season.seasonNumber}E${ep.episodeNumber}: ${ep.title}...`);

          await api.post(`/tv/${showId}/seasons/${seasonId}/episodes`, {
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            overview: ep.overview || undefined,
            duration: ep.duration || undefined,
            stillPath: ep.stillPath || undefined,
            videoSources: ep.videoUrl ? [{ label: "Default", url: ep.videoUrl }] : [],
            published: ep.published,
          });
        }
      }

      setCreatingProgress("Done! Redirecting...");
      router.push(`/tv/${showId}`);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to create show";
      if (e.response?.status === 409) {
        setError("A show with this title/slug already exists. Please choose a different title or slug.");
      } else {
        setError(msg);
      }
      setCreatingProgress("");
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.SHOW_DETAILS:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-gray-300">Title <span className="text-red-500">*</span></label>
              <input
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-red-500 focus:outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Show title"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-300">Overview</label>
              <textarea
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-red-500 focus:outline-none"
                rows={4}
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                placeholder="Short description"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-300">Poster</label>
                <VideoUploader
                  storagePathBuilder={(f) => `shows/${Date.now()}-${f.name}`}
                  initialUrl={poster}
                  onUploaded={setPoster}
                  accept="image/*"
                />
                {poster && (
                  <img src={poster} alt="Poster preview" className="mt-2 w-32 rounded border border-white/10" />
                )}
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-300">Banner / Backdrop</label>
                <VideoUploader
                  storagePathBuilder={(f) => `shows/${Date.now()}-banner-${f.name}`}
                  initialUrl={backdrop}
                  onUploaded={setBackdrop}
                  accept="image/*"
                />
                {backdrop && (
                  <img src={backdrop} alt="Backdrop preview" className="mt-2 w-full max-w-md rounded border border-white/10" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-300">Trailer URL (optional)</label>
              <input
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-red-500 focus:outline-none"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-300">Genres (comma-separated)</label>
              <input
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-red-500 focus:outline-none"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                placeholder="e.g. drama, sci-fi"
              />
            </div>
            <details className="bg-gray-800/30 rounded p-3">
              <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-200">
                Advanced (custom slug)
              </summary>
              <div className="mt-3">
                <label className="block text-sm mb-1 text-gray-300">Slug (optional)</label>
                <input
                  className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-red-500 focus:outline-none"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generated from title if left empty"
                />
              </div>
            </details>
            <div className="flex items-center gap-2">
              <input
                id="published"
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-4 h-4 accent-red-600"
              />
              <label htmlFor="published" className="text-gray-300">Published</label>
            </div>
          </div>
        );

      case STEPS.SEASONS:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">Add seasons to your TV show. You can skip this step and add seasons later.</p>
              <button
                type="button"
                onClick={addSeason}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
              >
                <span>+</span> Add Season
              </button>
            </div>

            {seasons.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
                <p className="text-gray-400 mb-3">No seasons added yet</p>
                <button
                  type="button"
                  onClick={addSeason}
                  className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Add your first season
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {seasons.map((season, idx) => (
                  <div key={idx} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">Season {season.seasonNumber}</h3>
                      <button
                        type="button"
                        onClick={() => removeSeason(idx)}
                        className="text-red-400 hover:text-red-300 px-2 py-1"
                      >
                        × Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Season Number</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-red-500 focus:outline-none"
                          value={season.seasonNumber}
                          onChange={(e) => updateSeason(idx, 'seasonNumber', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
                        <input
                          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-red-500 focus:outline-none"
                          value={season.name}
                          onChange={(e) => updateSeason(idx, 'name', e.target.value)}
                          placeholder="e.g. Season 1: Origins"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Season Poster</label>
                        <VideoUploader
                          storagePathBuilder={(f) => `shows/seasons/${Date.now()}-${f.name}`}
                          initialUrl={season.poster}
                          onUploaded={(url) => updateSeason(idx, 'poster', url)}
                          accept="image/*"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Season Backdrop</label>
                        <VideoUploader
                          storagePathBuilder={(f) => `shows/seasons/${Date.now()}-backdrop-${f.name}`}
                          initialUrl={season.backdrop}
                          onUploaded={(url) => updateSeason(idx, 'backdrop', url)}
                          accept="image/*"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={season.published}
                        onChange={(e) => updateSeason(idx, 'published', e.target.checked)}
                        className="w-4 h-4 accent-red-600"
                      />
                      <span className="text-sm text-gray-300">Published</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case STEPS.EPISODES:
        return (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Add episodes to each season. You can skip this step and add episodes later.</p>

            {seasons.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
                <p className="text-gray-400">No seasons to add episodes to.</p>
                <p className="text-gray-500 text-sm mt-1">Go back and add seasons first, or skip this step.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {seasons.map((season, sIdx) => (
                  <div key={sIdx} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSeasonExpand(sIdx)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition"
                    >
                      <span className="font-semibold text-white">
                        Season {season.seasonNumber}: {season.name || `Season ${season.seasonNumber}`}
                        <span className="ml-2 text-gray-400 text-sm">
                          ({season.episodes.length} episode{season.episodes.length !== 1 ? 's' : ''})
                        </span>
                      </span>
                      <span className="text-gray-400">{expandedSeasons.has(sIdx) ? '▼' : '▶'}</span>
                    </button>

                    {expandedSeasons.has(sIdx) && (
                      <div className="px-4 pb-4 border-t border-gray-700">
                        <div className="mt-3 space-y-3">
                          {season.episodes.map((ep, eIdx) => (
                            <div key={eIdx} className="bg-gray-900/50 rounded-lg border border-gray-600 p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-200">Episode {ep.episodeNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => removeEpisode(sIdx, eIdx)}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  × Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Episode Number</label>
                                  <input
                                    type="number"
                                    className="w-full px-2 py-1.5 rounded bg-gray-800 border border-gray-600 focus:border-red-500 focus:outline-none text-sm"
                                    value={ep.episodeNumber}
                                    onChange={(e) => updateEpisode(sIdx, eIdx, 'episodeNumber', Number(e.target.value))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Title <span className="text-red-500">*</span></label>
                                  <input
                                    className="w-full px-2 py-1.5 rounded bg-gray-800 border border-gray-600 focus:border-red-500 focus:outline-none text-sm"
                                    value={ep.title}
                                    onChange={(e) => updateEpisode(sIdx, eIdx, 'title', e.target.value)}
                                    placeholder="Episode title"
                                  />
                                </div>
                              </div>
                              <div className="mt-2">
                                <label className="block text-xs text-gray-400 mb-1">Overview</label>
                                <textarea
                                  className="w-full px-2 py-1.5 rounded bg-gray-800 border border-gray-600 focus:border-red-500 focus:outline-none text-sm"
                                  rows={2}
                                  value={ep.overview}
                                  onChange={(e) => updateEpisode(sIdx, eIdx, 'overview', e.target.value)}
                                  placeholder="Episode description"
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Video URL</label>
                                  <VideoUploader
                                    storagePathBuilder={(f) => `episodes/${Date.now()}-${f.name}`}
                                    initialUrl={ep.videoUrl}
                                    onUploaded={(url) => updateEpisode(sIdx, eIdx, 'videoUrl', url)}
                                    accept="video/*"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Duration (minutes)</label>
                                  <input
                                    type="number"
                                    className="w-full px-2 py-1.5 rounded bg-gray-800 border border-gray-600 focus:border-red-500 focus:outline-none text-sm"
                                    value={ep.duration || ""}
                                    onChange={(e) => updateEpisode(sIdx, eIdx, 'duration', Number(e.target.value))}
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={ep.published}
                                  onChange={(e) => updateEpisode(sIdx, eIdx, 'published', e.target.checked)}
                                  className="w-3 h-3 accent-red-600"
                                />
                                <span className="text-xs text-gray-300">Published</span>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addEpisode(sIdx)}
                            className="w-full py-2 rounded-md border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 transition"
                          >
                            + Add Episode
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case STEPS.REVIEW:
        const totalEpisodes = seasons.reduce((sum, s) => sum + s.episodes.length, 0);
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-lg border border-gray-700 p-6">
              <h3 className="text-xl font-bold text-white mb-4">{title || "Untitled Show"}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-500">{seasons.length}</div>
                  <div className="text-xs text-gray-400">Seasons</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-500">{totalEpisodes}</div>
                  <div className="text-xs text-gray-400">Episodes</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-500">{genres.split(",").filter(g => g.trim()).length}</div>
                  <div className="text-xs text-gray-400">Genres</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className={`text-2xl font-bold ${published ? 'text-green-500' : 'text-yellow-500'}`}>
                    {published ? '✓' : '○'}
                  </div>
                  <div className="text-xs text-gray-400">{published ? 'Published' : 'Draft'}</div>
                </div>
              </div>
            </div>

            {/* Show Details Summary */}
            <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Show Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-400">Title:</span> <span className="text-white">{title}</span></div>
                  <div><span className="text-gray-400">Genres:</span> <span className="text-white">{genres || "None"}</span></div>
                  <div><span className="text-gray-400">Trailer:</span> <span className="text-white">{trailerUrl || "None"}</span></div>
                </div>
                <div className="flex gap-3">
                  {poster && <img src={poster} alt="Poster" className="w-20 h-28 object-cover rounded" />}
                  {backdrop && <img src={backdrop} alt="Backdrop" className="w-32 h-20 object-cover rounded" />}
                </div>
              </div>
            </div>

            {/* Seasons Summary */}
            {seasons.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Seasons & Episodes</h4>
                <div className="space-y-2">
                  {seasons.map((season, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <span className="text-white">Season {season.seasonNumber}: {season.name}</span>
                      <span className="text-gray-400 text-sm">{season.episodes.length} episode(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {creatingProgress && (
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                <span className="text-blue-300">{creatingProgress}</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Create TV Show</h1>
            <p className="text-gray-400 text-sm mt-1">Add a new TV show with seasons and episodes</p>
          </div>

          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEP_LABELS.map((label, idx) => (
                <div key={idx} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${idx < currentStep
                          ? "bg-green-600 text-white"
                          : idx === currentStep
                            ? "bg-red-600 text-white ring-4 ring-red-600/30"
                            : "bg-gray-700 text-gray-400"
                        }`}
                    >
                      {idx < currentStep ? "✓" : idx + 1}
                    </div>
                    <span
                      className={`mt-2 text-xs ${idx === currentStep ? "text-white font-medium" : "text-gray-500"
                        }`}
                    >
                      {label}
                    </span>
                  </div>
                  {idx < STEP_LABELS.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded ${idx < currentStep ? "bg-green-600" : "bg-gray-700"
                        }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
              <span>⚠</span>
              {error}
            </div>
          )}

          {/* Step Content */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 mb-6">
            {renderStepContent()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => currentStep === 0 ? history.back() : handleBack()}
              className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50"
              disabled={loading}
            >
              {currentStep === 0 ? "Cancel" : "← Back"}
            </button>

            {currentStep === STEPS.REVIEW ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading || !title}
                className="px-6 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  "Create TV Show"
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
