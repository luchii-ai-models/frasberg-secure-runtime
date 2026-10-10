import React from "react";
import { Wand2 } from "lucide-react";

export function PresetRow({ presets, onPick, testid = "preset", label = "Quick presets", hint }) {
  return (
    <div data-testid={`${testid}-row`}>
      <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-neutral-300">
        <Wand2 className="w-3.5 h-3.5 text-[#00F0FF]" /> {label}
        {hint && <span className="ml-1 text-xs font-normal text-neutral-500">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`${testid}-${p.id}`}
            onClick={() => onPick(p)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm border transition-colors ${p.surprise
              ? "border-[#00F0FF]/50 bg-[#00F0FF]/10 text-white hover:bg-[#00F0FF]/20"
              : "border-white/10 bg-white/5 text-neutral-300 hover:bg-[#00F0FF]/15 hover:border-[#00F0FF]/50 hover:text-white"}`}
          >
            {p.icon && <p.icon className="w-3.5 h-3.5 text-[#00F0FF]" />}
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
