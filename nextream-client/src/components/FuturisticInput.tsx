"use client";

import React from "react";

interface FuturisticInputProps {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
}

const FuturisticInput: React.FC<FuturisticInputProps> = ({
  type,
  placeholder,
  value,
  onChange,
  required = false,
  className = "",
}) => {
  return (
    <div className="relative group">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className={`
          w-full px-4 py-3.5 rounded-md
          bg-gray-800/60 backdrop-blur-sm
          text-white 
          border border-blue-500/40
          focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400
          transition-all duration-300
          placeholder:text-gray-400
          ${className}
        `}
      />
      <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 rounded-md border border-transparent bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 opacity-30"></div>
      </div>
    </div>
  );
};

export default FuturisticInput;
