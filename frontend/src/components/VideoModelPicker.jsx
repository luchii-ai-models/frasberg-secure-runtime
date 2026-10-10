import React from "react";
import { Wand2 } from "lucide-react";
import { brand } from "../mock";

const OPTIONS = [
  { id: "auto", name: "Auto", desc: "Best model and quality for your idea" },
  { id: "Luchii Cinematica", name: "Luchii Cinematica", desc: "Text to cinematic video" },
  { id: "Luchii Animus", name: "Luchii Animus", desc: "Bring a photo to life" },
];

export const VideoModelPicker = ({ value, onChange, hasImage }) => (
  <div data-testid="video-model-picker">
    <label className="text-sm font-medium text-neutral-300 mb-2 block">Luchii model</label>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {OPTIONS.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={on}
            data-testid={`video-model-${o.id === "auto" ? "auto" : o.id.split(" ")[1].toLowerCase()}`}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${on
              ? "border-[#00F0FF]/70 bg-[#00F0FF]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
            {o.id === "auto"
              ? <span className="w-7 h-7 rounded-full grid place-items-center bg-[#00F0FF]/15 shrink-0"><Wand2 className="w-4 h-4 text-[#00F0FF]" /></span>
              : <img src={brand.luchiiLogo} alt="" className="w-7 h-7 rounded-full object-contain shrink-0" />}
            <span className="min-w-0">
              <span className="block text-xs font-semibold">{o.name}</span>
              <span className="block text-[11px] text-neutral-500">{o.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
    {value === "auto" && (
      <p className="mt-2 text-[11px] text-neutral-500" data-testid="video-model-auto-note">
        Auto uses {hasImage ? "Luchii Animus for your photo" : "Luchii Cinematica"} at the best available quality.
      </p>
    )}
    {value === "Luchii Cinematica" && hasImage && (
      <p className="mt-2 text-[11px] text-neutral-500">Cinematica works from your prompt only, so the start photo is skipped.</p>
    )}
  </div>
);
