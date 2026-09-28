"use client";

import React from "react";

export type ButtonVariant = "primary" | "outline" | "active" | "disabled";

export interface CustomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  variant = "primary",
  children = "Button",
  fullWidth = true,
  disabled = false,
  className = "",
  ...props
}) => {
  const isButtonDisabled = disabled || variant === "disabled";

  const getVariantStyles = () => {
    if (isButtonDisabled) {
      return "bg-[#CBD5E1] text-[#94A3B8] cursor-not-allowed shadow-none border border-transparent";
    }

    switch (variant) {
      case "outline":
        return "bg-white text-[#1E3765] border border-[#1E3765] hover:bg-[#F2F5FB] shadow-xs active:scale-[0.98]";
      case "active":
        return "bg-[#0F2342] text-white shadow-md shadow-[#0F2342]/20 hover:bg-[#081a34] active:scale-[0.98] border border-transparent";
      case "primary":
      default:
        return "bg-[#1E3765] text-white shadow-md shadow-[#1E3765]/20 hover:bg-[#0F2342] active:bg-[#0F2342] active:scale-[0.98] border border-transparent";
    }
  };

  return (
    <button
      disabled={isButtonDisabled}
      className={`h-10 px-4 rounded-lg font-bold text-sm tracking-wide transition-all duration-150 flex items-center justify-center select-none ${
        fullWidth ? "w-full" : "w-auto"
      } ${getVariantStyles()} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default CustomButton;
