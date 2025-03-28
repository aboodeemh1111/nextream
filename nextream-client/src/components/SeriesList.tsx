"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  FaChevronLeft,
  FaChevronRight,
  FaPlay,
  FaInfoCircle,
} from "react-icons/fa";

interface SeriesListProps {
  listId?: string;
  title: string;
  cardSize?: "small" | "medium" | "large";
  genreFilter?: string;
  limit?: number;
}

interface Series {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgSm: string;
  year: string;
  genre: string;
  limit: number;
  status?: string;
  totalSeasons?: number;
  isOriginal?: boolean;
}

const SeriesList: React.FC<SeriesListProps> = ({
  listId,
  title,
  cardSize = "medium",
  genreFilter,
  limit = 10,
}) => {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchSeries = async () => {
      try {
        setLoading(true);
        setError(null);

        let url = "/api/series";
        if (listId) {
          url = `/api/lists/${listId}/content`;
        } else if (genreFilter) {
          url = `/api/series?genre=${genreFilter}`;
        }

        const res = await axios.get(url, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
          params: { limit },
        });

        if (Array.isArray(res.data)) {
          setSeries(res.data);
        } else if (res.data.content && Array.isArray(res.data.content)) {
          // If response has a content property (list response)
          setSeries(res.data.content);
        }
      } catch (err: any) {
        console.error("Error fetching series:", err);
        setError("Failed to load series");
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();

    // Add resize listener to check scroll capabilities
    const handleResize = () => checkScrollability();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [user, listId, genreFilter, limit]);

  useEffect(() => {
    // Check if we can scroll after content loads
    if (series.length > 0) {
      checkScrollability();
    }
  }, [series]);

  const checkScrollability = () => {
    if (listRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = listRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
      setShowControls(scrollWidth > clientWidth);
    }
  };

  const handleScroll = () => {
    checkScrollability();
  };

  const scrollList = (direction: "left" | "right") => {
    if (!listRef.current) return;

    const { clientWidth } = listRef.current;
    const scrollAmount = clientWidth * 0.8; // Scroll 80% of the visible width

    listRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const getCardWidth = () => {
    switch (cardSize) {
      case "small":
        return "w-32 sm:w-40 md:w-48";
      case "large":
        return "w-56 sm:w-64 md:w-72";
      default: // medium
        return "w-40 sm:w-52 md:w-60";
    }
  };

  const getCardHeight = () => {
    switch (cardSize) {
      case "small":
        return "h-20 sm:h-24 md:h-28";
      case "large":
        return "h-32 sm:h-40 md:h-44";
      default: // medium
        return "h-24 sm:h-32 md:h-36";
    }
  };

  if (loading) {
    return (
      <div className="mb-10">
        <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
        <div className="flex space-x-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`${getCardWidth()} ${getCardHeight()} rounded bg-gray-800 animate-pulse`}
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-10">
        <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
        <div className="p-4 bg-red-900/20 rounded text-red-200">{error}</div>
      </div>
    );
  }

  if (series.length === 0) {
    return null; // Don't display empty lists
  }

  return (
    <div className="mb-10 relative" onMouseLeave={() => setHoveredItemId(null)}>
      <h2 className="text-white text-xl font-bold mb-4">{title}</h2>

      <div className="relative group">
        {/* Left scroll control */}
        {showControls && (
          <button
            onClick={() => scrollList("left")}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/60 text-white ${
              canScrollLeft
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-0 cursor-default"
            } transition-opacity duration-300`}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
          >
            <FaChevronLeft />
          </button>
        )}

        {/* Series List */}
        <div
          ref={listRef}
          className="flex space-x-4 overflow-x-auto no-scrollbar"
          onScroll={handleScroll}
        >
          {series.map((item) => (
            <div
              key={item._id}
              className={`${getCardWidth()} flex-shrink-0 relative group/item transition-transform duration-300 hover:scale-105 z-10 hover:z-20`}
              onMouseEnter={() => setHoveredItemId(item._id)}
              onMouseLeave={() => setHoveredItemId(null)}
            >
              <Link href={`/series/${item._id}`}>
                {/* Card Content */}
                <div
                  className={`${getCardHeight()} relative rounded-md overflow-hidden`}
                >
                  <Image
                    src={item.imgSm || item.img}
                    alt={item.title}
                    fill
                    className="object-cover transition-all duration-500 group-hover/item:brightness-75"
                  />

                  {/* Hover content */}
                  {hoveredItemId === item._id && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="text-white font-bold truncate">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 text-white text-xs mt-1">
                          <span>{item.year}</span>
                          {item.limit > 0 && (
                            <span className="px-1 border border-white/40 rounded">
                              {item.limit}+
                            </span>
                          )}
                          {item.totalSeasons && (
                            <span>
                              {item.totalSeasons} Season
                              {item.totalSeasons !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <button className="bg-white rounded-full w-8 h-8 flex items-center justify-center text-black">
                            <FaPlay size={12} />
                          </button>
                          <button className="bg-gray-700/80 rounded-full w-8 h-8 flex items-center justify-center text-white">
                            <FaInfoCircle size={12} />
                          </button>
                        </div>
                      </div>

                      {item.isOriginal && (
                        <div className="absolute top-0 left-0 bg-blue-600/90 text-white text-xs px-2 py-1">
                          Original
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Right scroll control */}
        {showControls && (
          <button
            onClick={() => scrollList("right")}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/60 text-white ${
              canScrollRight
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-0 cursor-default"
            } transition-opacity duration-300`}
            disabled={!canScrollRight}
            aria-label="Scroll right"
          >
            <FaChevronRight />
          </button>
        )}
      </div>
    </div>
  );
};

export default SeriesList;
