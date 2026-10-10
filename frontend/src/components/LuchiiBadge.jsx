import React from "react";
import { brand } from "../mock";

const IMAGE_MODELS = { edit: "Luchii Painter-X", upscale: "Luchii Prime" };
const STYLE_MODELS = { anime: "Luchii Dreamline", "digital-art": "Luchii Dreamline", "3d": "Luchii Vision" };

export const luchiiModelFor = (kind, style, mode) =>
  kind === "video" ? (mode === "image-to-video" ? "Luchii Animus" : "Luchii Cinematica")
    : kind === "music" ? "Luchii Harmonia"
    : IMAGE_MODELS[kind] || STYLE_MODELS[style] || "Luchii Nova-Muse";

export const LuchiiBadge = ({ model, overlay = false, className = "", testId = "luchii-badge" }) => (
  <span data-testid={testId} title={`Made with ${model || "a Luchii model"} by Frasberg`}
    className={`inline-flex items-center gap-1.5 rounded-full border border-[#00F0FF]/30 bg-black/70 backdrop-blur-md pl-0.5 pr-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white pointer-events-none max-w-[85%] ${overlay ? "absolute bottom-2 right-2 z-10" : ""} ${className}`}>
    <img src={brand.luchiiLogo} alt="Luchii logo" className="w-5 h-5 rounded-full object-contain shrink-0" />
    <span className="truncate">{model || "Luchii"}</span>
  </span>
);
