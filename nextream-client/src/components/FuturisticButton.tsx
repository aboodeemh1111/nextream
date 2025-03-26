"use client";

import React from "react";

interface FuturisticButtonProps {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

const FuturisticButton: React.FC<FuturisticButtonProps> = ({
  type = "button",
  disabled = false,
  onClick,
  children,
  className = "",
}) => {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`
        relative overflow-hidden
        w-full px-6 py-3.5 rounded-md
        bg-gradient-to-r from-blue-600 to-purple-600
        text-white font-medium text-lg
        transform transition-all duration-300
        disabled:opacity-70 disabled:cursor-not-allowed
        hover:from-blue-500 hover:to-purple-500
        active:scale-[0.98]
        ${className}
      `}
    >
      {/* Glow effect */}
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-400 to-purple-500 opacity-0 hover:opacity-30 transition-opacity duration-300"></span>

      {/* Button text */}
      <span className="relative z-10 flex items-center justify-center">
        {disabled && (
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </span>

      {/* Animated border */}
      <span className="absolute inset-0 rounded-md border border-cyan-400/50 opacity-0 group-hover:opacity-100"></span>
    </button>
  );
};

export default FuturisticButton;
