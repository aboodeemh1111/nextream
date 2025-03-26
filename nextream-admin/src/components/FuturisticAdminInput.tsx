"use client";

import React, { useState } from "react";
import { FaSearch, FaEnvelope, FaLock, FaUser } from "react-icons/fa";

interface FuturisticAdminInputProps {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  icon?: "search" | "email" | "password" | "user" | "none";
  label?: string;
  error?: string;
}

const FuturisticAdminInput: React.FC<FuturisticAdminInputProps> = ({
  type,
  placeholder,
  value,
  onChange,
  required = false,
  className = "",
  icon = "none",
  label,
  error,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getIcon = () => {
    switch (icon) {
      case "search":
        return <FaSearch className="text-blue-400" />;
      case "email":
        return <FaEnvelope className="text-blue-400" />;
      case "password":
        return <FaLock className="text-blue-400" />;
      case "user":
        return <FaUser className="text-blue-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-200 mb-1">
          {label}
        </label>
      )}
      <div
        className={`
          relative group transition-all duration-300 transform
          ${isFocused ? "scale-[1.02]" : ""}
        `}
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-lg blur-sm"></div>

        {/* Input container */}
        <div className="relative">
          {icon !== "none" && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {getIcon()}
            </div>
          )}

          <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            required={required}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`
              w-full px-4 py-3 rounded-lg
              ${icon !== "none" ? "pl-10" : ""}
              bg-slate-800/80 backdrop-blur-md
              text-white border border-slate-700
              focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
              transition-all duration-300
              placeholder:text-slate-400
              ${
                error
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : ""
              }
              ${className}
            `}
          />

          {/* Animated border effect */}
          <div
            className={`
              absolute inset-0 rounded-lg 
              pointer-events-none
              overflow-hidden
              ${isFocused ? "border border-transparent" : ""}
            `}
          >
            <div
              className={`
                absolute inset-0 rounded-lg
                bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500
                opacity-0 group-hover:opacity-30 
                ${isFocused ? "opacity-40" : ""}
                transition-opacity duration-300
              `}
            ></div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
};

export default FuturisticAdminInput;
