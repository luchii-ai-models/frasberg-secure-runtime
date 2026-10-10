import React from "react";
import { brand } from "../mock";

export const LuchiiBadge = ({ overlay = false, className = "", testId = "luchii-badge" }) => (
  <span data-testid={testId} title="Made with a Luchii model by Frasberg"
    className={`inline-flex items-center gap-1.5 rounded-full border border-[#00F0FF]/30 bg-black/70 backdrop-blur-md pl-0.5 pr-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white pointer-events-none ${overlay ? "absolute bottom-2 right-2 z-10" : ""} ${className}`}>
    <img src={brand.luchiiLogo} alt="Luchii logo" className="w-5 h-5 rounded-full object-contain" />
    Luchii
  </span>
);
