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
        return "bg-[#EEF4FF] text-[#155DFC] border border-[#155DFC] hover:bg-[#DCE8FF] shadow-xs active:scale-[0.98]";
      case "active":
        return "bg-[#0F2342] text-white shadow-md shadow-[#0F2342]/20 hover:bg-[#081a34] active:scale-[0.98] border border-transparent";
      case "primary":
      default:
        return "bg-[#155DFC] text-white shadow-[3px_3px_14px_rgba(87,138,252,0.4)] hover:bg-[#0D4FDB] active:bg-[#0B43BA] active:scale-[0.98] border border-transparent";
    }
  };

  return (
    <button
      disabled={isButtonDisabled}
      className={`h-11 px-5 rounded-[15px] font-bold text-sm tracking-wide transition-all duration-150 flex items-center justify-center select-none ${
        fullWidth ? "w-full" : "w-auto"
      } ${getVariantStyles()} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default CustomButton;
