import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Bot, Loader2, Image as ImageIcon, Clapperboard, Music, Check, AlertTriangle, Sparkles } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Textarea } from "../components/ui/textarea";
import { LuchiiBadge, LUCHII_PICKER } from "../components/LuchiiBadge";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const BASE = process.env.REACT_APP_BACKEND_URL;
const API = `${BASE}/api`;
const META = {
  image: { icon: ImageIcon, label: "Image", model: (t) => t.model || "Luchii Nova-Muse" },
  video: { icon: Clapperboard, label: "Video", model: () => "Luchii Cinematica" },
  music: { icon: Music, label: "Song", model: () => "Luchii Harmonia" },
};
const IDEAS = ["A lighthouse on a stormy cliff at night", "A neon samurai walking through rainy Tokyo", "A cozy cabin in a snowy forest at dawn"];

function useImage(genId) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!genId) return;
    axios.get(`${API}/share/${genId}`).then(({ data }) => setImg(data.image_base64)).catch(() => {});
  }, [genId]);
  return img;
}

function TaskCard({ t }) {
  const m = META[t.type];
  const img = useImage(t.type === "image" ? t.result?.generation_id : null);
  const job = t.job;
  const failed = t.status === "failed" || job?.status === "failed";
  const done = t.type === "image" ? !!img : job?.status === "completed";
  const src = job?.url ? `${BASE}${job.url}` : null;
  const state = failed ? "Failed" : done ? "Done" : t.status === "queued" || t.status === "waiting" ? "Waiting for its turn" : job?.status === "running" ? `Working${job.progress ? ` · ${job.progress}%` : "..."}` : "Working...";
  return (
    <div data-testid={`agent-task-${t.type}`} className="rounded-2xl border border-white/10 bg-[#1E2327]/80 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><m.icon className="w-4 h-4 text-[#00F0FF]" /> {m.label}</span>
        <span data-testid={`agent-task-${t.type}-status`} className={`inline-flex items-center gap-1 text-[11px] ${failed ? "text-red-300" : done ? "text-emerald-300" : "text-neutral-400"}`}>
          {failed ? <AlertTriangle className="w-3 h-3" /> : done ? <Check className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />} {state}
        </span>
      </div>
      <div className="relative rounded-xl overflow-hidden bg-black/40 border border-white/5 aspect-video grid place-items-center">
        {t.type === "image" && img && <img src={img} alt={t.prompt} className="w-full h-full object-cover" />}
        {t.type === "video" && done && src && <video src={src} controls loop playsInline className="w-full h-full object-contain" />}
        {t.type === "music" && done && src && <audio src={src} controls className="w-[90%]" />}
        {!done && !failed && <Loader2 className="w-6 h-6 animate-spin text-[#00F0FF]/70" />}
        {failed && <p className="text-xs text-red-300 px-4 text-center">{t.error || job?.error || "This part could not be made."}</p>}
        {done && <LuchiiBadge overlay model={m.model(t)} testId={`agent-task-${t.type}-badge`} />}
      </div>
      <p className="text-xs text-neutral-500 line-clamp-2">{t.prompt}</p>
      {done && t.type === "image" && <Link to={`/s/${t.result.generation_id}`} className="text-xs text-[#00F0FF] hover:underline">Open image</Link>}
      {done && t.type === "video" && <Link to={`/v/${job.job_id}`} className="text-xs text-[#00F0FF] hover:underline">Open video</Link>}
    </div>
  );
}

export default function LuchiiAgent() {
  const { user, authHeader } = useAuth();
  const [idea, setIdea] = useState("");
  const [imageModel, setImageModel] = useState("Luchii Nova-Muse");
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);

  const poll = (id) => {
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/chat/agents/bundle/${id}`, { headers: authHeader });
        setBundle(data);
        const finished = data.tasks.every((t) => t.status === "failed" || (t.type === "image" ? t.status === "dispatched" : ["completed", "failed"].includes(t.job?.status)));
        if (finished) { clearInterval(timer.current); setBusy(false); }
      } catch { /* keep polling */ }
    }, 5000);
  };

  const start = async () => {
    if (!idea.trim()) { toast.error("Type one idea first."); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/chat/agents/bundle`, { idea: idea.trim(), image_model: imageModel }, { headers: authHeader });
      setBundle(data);
      poll(data.bundle_id);
      toast.success("Luchii agent is on it: image, video, then song.");
    } catch (e) {
      setBusy(false);
      toast.error(e?.response?.data?.detail || "Could not start the agent.");
    }
  };

  return (
    <div className="min-h-screen bg-[#05060A] text-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-5 md:px-8 pt-28 pb-24" data-testid="luchii-agent-page">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 mb-5">
          <Bot className="w-3.5 h-3.5 text-[#00F0FF]" /> Luchii Agent
        </div>
        <h1 className="font-display font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl">
          One idea. <span className="text-[#00F0FF]">Image, video and song.</span>
        </h1>
        <p className="mt-4 text-neutral-400 text-sm md:text-base max-w-2xl">Type a single idea and a Luchii agent makes a matching image, video and soundtrack for you, one after another.</p>

        {!user ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6" data-testid="agent-login-gate">
            <p className="text-neutral-300">Sign in so your agent's creations are saved to your gallery.</p>
            <Link to="/login?next=/agent" data-testid="agent-login-btn" className="inline-flex mt-4 rounded-full bg-[#00F0FF] text-black font-semibold px-5 py-2.5">Log in</Link>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 space-y-4">
            <Textarea data-testid="agent-idea-input" value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={400}
              placeholder="A lighthouse on a stormy cliff at night..." className="min-h-[110px] bg-black/40 border-white/10 resize-none focus-visible:ring-[#00F0FF]" />
            <div className="flex flex-wrap gap-2">
              {IDEAS.map((i) => (
                <button key={i} onClick={() => setIdea(i)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 hover:bg-white/10">{i}</button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-300 mb-2 block">Image model</label>
              <div className="flex flex-wrap gap-2" data-testid="agent-image-model">
                {LUCHII_PICKER.text.map((m) => (
                  <button key={m.name} onClick={() => setImageModel(m.name)} aria-pressed={imageModel === m.name}
                    data-testid={`agent-model-${m.name.split(" ")[1].toLowerCase()}`}
                    className={`rounded-full border px-3 py-1.5 text-xs ${imageModel === m.name ? "border-[#00F0FF]/70 bg-[#00F0FF]/10 text-white" : "border-white/10 bg-white/5 text-neutral-400"}`}>{m.name}</button>
                ))}
              </div>
            </div>
            <button onClick={start} disabled={busy} data-testid="agent-start-btn"
              className="w-full h-12 rounded-full bg-[#00F0FF] text-black font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#00d4de] transition-colors">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {busy ? "Your agent is working..." : "Send Luchii agent"}
            </button>
          </div>
        )}

        {bundle && (
          <div className="mt-10 grid md:grid-cols-3 gap-4" data-testid="agent-results">
            {bundle.tasks.map((t) => <TaskCard key={t.id} t={t} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
