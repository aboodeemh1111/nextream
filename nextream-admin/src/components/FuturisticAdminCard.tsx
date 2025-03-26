"use client";

import React from "react";

interface FuturisticAdminCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  glowColor?: "blue" | "purple" | "teal" | "default" | "none";
  isLoading?: boolean;
}

const FuturisticAdminCard: React.FC<FuturisticAdminCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  className = "",
  headerAction,
  glowColor = "default",
  isLoading = false,
}) => {
  const getGlowStyles = () => {
    if (glowColor === "none") return "";

    const colors = {
      blue: "from-blue-500/20 via-transparent to-transparent",
      purple: "from-purple-500/20 via-transparent to-transparent",
      teal: "from-teal-500/20 via-transparent to-transparent",
      default: "from-blue-600/10 via-indigo-500/10 to-transparent",
    };

    return colors[glowColor] || colors.default;
  };

  return (
    <div
      className={`
        relative overflow-hidden 
        rounded-xl backdrop-blur-sm 
        bg-slate-800/80 border border-slate-700/50
        shadow-lg hover:shadow-xl transition-all duration-300
        ${className}
      `}
    >
      {/* Background glow */}
      {glowColor !== "none" && (
        <div
          className={`
            absolute top-0 left-0 right-0 h-1.5
            bg-gradient-to-r ${getGlowStyles()}
          `}
        ></div>
      )}

      {/* Header */}
      {(title || icon || headerAction) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            {icon && (
              <div className="p-2 rounded-lg bg-slate-700/50 text-blue-400">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-white">{title}</h3>
              )}
              {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}

      {/* Content */}
      <div className={`p-5 ${isLoading ? "animate-pulse" : ""}`}>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-6 bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            <div className="h-4 bg-slate-700 rounded w-5/6"></div>
            <div className="h-4 bg-slate-700 rounded w-1/4"></div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Glass reflection effect */}
      <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
        <div className="absolute -inset-1 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
    </div>
  );
};

export default FuturisticAdminCard;
