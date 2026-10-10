import React, { useEffect, useState } from "react";

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Elapsed timer + estimated progress bar for long local renders. The bar eases toward 95%
// around the ETA and never claims to be finished before the server says so.
export default function RenderProgress({ eta = 60, queued = false, testId = "render-progress" }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const pct = queued ? 4 : Math.min(95, Math.round(95 * (1 - Math.exp(-2.2 * elapsed / eta))));
  const left = Math.max(0, eta - elapsed);
  return (
    <div data-testid={testId} title={`${fmt(elapsed)} elapsed`} className="w-56 max-w-[70vw] mx-auto mt-5">
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#7cf9ff] transition-[width] duration-1000 ease-out"
          style={{ width: `${pct}%` }} />
      </div>
      <span className="sr-only" data-testid={`${testId}-elapsed`}>{fmt(elapsed)} elapsed, {queued ? "waiting in queue" : left > 0 ? `about ${fmt(left)} left` : "finishing"}</span>
    </div>
  );
}
