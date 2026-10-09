import React from "react";
import { Wand2 } from "lucide-react";

export function PresetRow({ presets, onPick, testid = "preset", label = "Quick presets" }) {
  return (
    <div data-testid={`${testid}-row`}>
      <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-neutral-300">
        <Wand2 className="w-3.5 h-3.5 text-[#00F0FF]" /> {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`${testid}-${p.id}`}
            onClick={() => onPick(p)}
            className="px-3.5 py-1.5 rounded-full text-sm border border-white/10 bg-white/5 text-neutral-300 hover:bg-[#00F0FF]/15 hover:border-[#00F0FF]/50 hover:text-white transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
