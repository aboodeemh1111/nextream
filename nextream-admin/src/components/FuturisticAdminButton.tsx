"use client";

import React from "react";
import { FaSpinner } from "react-icons/fa";

interface FuturisticAdminButtonProps {
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const FuturisticAdminButton: React.FC<FuturisticAdminButtonProps> = ({
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  onClick,
  children,
  className = "",
  icon,
  fullWidth = false,
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white";
      case "secondary":
        return "bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white";
      case "danger":
        return "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white";
      case "success":
        return "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white";
      default:
        return "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white";
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "px-3 py-1.5 text-sm";
      case "md":
        return "px-4 py-2.5 text-base";
      case "lg":
        return "px-6 py-3 text-lg";
      default:
        return "px-4 py-2.5 text-base";
    }
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        relative overflow-hidden
        rounded-lg font-medium
        ${getVariantClasses()}
        ${getSizeClasses()}
        ${fullWidth ? "w-full" : ""}
        transition-all duration-300
        transform hover:scale-[1.02] active:scale-[0.98]
        disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none
        shadow-lg hover:shadow-xl
        focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50
        ${className}
      `}
    >
      {/* Glow effect overlay */}
      <span className="absolute inset-0 w-full h-full bg-white opacity-0 hover:opacity-10 transition-opacity"></span>

      {/* Light border */}
      <span className="absolute inset-0 rounded-lg border border-white/10 pointer-events-none"></span>

      {/* Button content */}
      <span className="relative flex items-center justify-center">
        {loading && <FaSpinner className="animate-spin mr-2" />}
        {!loading && icon && <span className="mr-2">{icon}</span>}
        {children}
      </span>
    </button>
  );
};

export default FuturisticAdminButton;
