import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Clapperboard, Music, Loader2, Download, ImagePlus, X, Zap, Sparkles, Crown, Share2, Shuffle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LogoLoader from "../components/LogoLoader";
import { PresetRow } from "../components/PresetRow";
import { VIDEO_PRESETS, MUSIC_PRESETS, TIKTOK_VIDEO_PRESETS, SURPRISE_VIDEO_IDEAS, PHOTO_MOTION_PRESETS } from "../presets";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const BASE = process.env.REACT_APP_BACKEND_URL;
const API = `${BASE}/api`;

const PRESETS = { video: VIDEO_PRESETS, music: MUSIC_PRESETS };

const KINDS = {
  video: {
    icon: Clapperboard, badge: "Frasberg Motion · Video Creator", title: "Turn prompts into", accent: "cinematic video",
    sub: "Describe a scene or drop in a photo to animate it. Pick a Frasberg Motion engine, a look, a format and a length.",
    durations: [3, 5, 8], defaultDuration: 5, eta: (d) => `about ${Math.round(d * 0.6 + 1)}–${Math.round(d * 1.2 + 2)} min`,
    placeholder: "A red fox running through a snowy forest at dawn...",
    styles: [["cinematic", "Cinematic"], ["photoreal", "Photoreal"], ["anime", "Anime"], ["3d", "3D Animation"], ["noir", "Film Noir"], ["fantasy", "Fantasy"]],
  },
  music: {
    icon: Music, badge: "Frasberg Music · Audio Studio", title: "Generate", accent: "music & audio beds",
    sub: "Describe a mood, instruments or genre, then pick a style and length. Frasberg composes an original track from your prompt.",
    durations: [10, 20, 30], defaultDuration: 10, eta: (d) => `about ${Math.round(d / 8)}–${Math.round(d / 5)} min`,
    placeholder: "Haunting dark noir with soft piano and brushed drums...",
    styles: [["lofi", "Lo-fi"], ["cinematic", "Cinematic"], ["electronic", "Electronic"], ["ambient", "Ambient"], ["rock", "Rock"], ["jazz", "Jazz"], ["hiphop", "Hip Hop"], ["acoustic", "Acoustic"]],
  },
};

function Chips({ kind, name, options, value, onChange, render }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const [id, label] = Array.isArray(o) ? o : [o, render(o)];
        return (
          <button key={id} data-testid={`${kind}-${name}-${id}`} onClick={() => onChange(value === id && name === "style" ? null : id)}
            className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${value === id
              ? "bg-[#00F0FF] text-black border-[#00F0FF] font-semibold"
              : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

const TIKTOK = TIKTOK_VIDEO_PRESETS.map((p) => (p.surprise ? { ...p, icon: Shuffle } : p));

export async function shareVideo(id) {
  const url = `${window.location.origin}/v/${id}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Made with Frasberg Motion", url }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast.success("Share link copied!"); } catch { toast.message("Copy this link to share", { description: url, duration: 10000 }); }
}

const ENGINE_ICONS = { fast: Zap, quality: Sparkles, ultra: Crown };
const ASPECTS = [["16:9", "16:9 Landscape"], ["9:16", "9:16 Vertical"], ["1:1", "1:1 Square"]];

function fmtEta(s) {
  if (!s) return "";
  return s < 90 ? `about ${s}s` : `about ${Math.round(s / 60)} min`;
}

async function toJpegDataUrl(file, max = 1280) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally { URL.revokeObjectURL(url); }
}

function EnginePicker({ engines, value, onChange }) {
  if (!engines.length) return null;
  return (
    <div>
      <label className="text-sm font-medium text-neutral-300 mb-2 block">Engine</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {engines.map((e) => {
          const Ico = ENGINE_ICONS[e.tier] || Zap;
          const on = e.status === "online";
          const sel = value === e.id;
          return (
            <button key={e.id} type="button" data-testid={`video-engine-${e.id}`} onClick={() => onChange(e.id)}
              className={`text-left rounded-xl border p-3 transition-colors ${sel ? "border-[#00F0FF] bg-[#00F0FF]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold"><Ico className="w-3.5 h-3.5 text-[#00F0FF]" />{e.name.replace("Frasberg ", "")}</span>
                <span data-testid={`video-engine-status-${e.id}`} title={on ? `${e.workers_online} GPU worker(s) online` : "No GPU worker online"}
                  className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${on ? "text-emerald-400" : "text-neutral-500"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-400" : "bg-neutral-600"}`} />{on ? (e.warm ? "warm" : "online") : "offline"}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-400">{e.blurb}</p>
              <p className="mt-1 text-[10px] text-neutral-500">{e.resolution} · {fmtEta(e.eta_seconds)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Progress({ kind, job, eta }) {
  const queued = job.status === "queued";
  const pct = job.progress ? ` ${Math.round(job.progress * 100)}%` : "";
  return (
    <div className="py-6" data-testid={queued ? `${kind}-queue-notice` : `${kind}-rendering`}>
      <LogoLoader
        label={queued ? `In the queue: #${job.queue_position || 1}` : kind === "video" ? `Rendering your clip...${pct}` : "Composing your track..."}
        sublabel={queued ? "Another request is finishing first. Yours starts next." : `Powered by Frasberg · ${eta}`} />
    </div>
  );
}

export default function Studio({ kind }) {
  const cfg = KINDS[kind];
  const { authHeader } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(cfg.defaultDuration);
  const [style, setStyle] = useState(cfg.styles[0][0]);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const fileRef = useRef(null);
  const [params] = useSearchParams();
  const [engines, setEngines] = useState([]);
  const [engine, setEngine] = useState(params.get("engine") || "frasberg-motion-fast");
  const [aspect, setAspect] = useState("16:9");
  const [startImage, setStartImage] = useState(null);

  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => {
    if (kind !== "video") return undefined;
    let alive = true;
    const load = () => axios.get(`${API}/gpu/v1/engines`)
      .then(({ data }) => alive && setEngines(data.data.filter((e) => e.kind === "video"))).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [kind]);

  const current = engines.find((e) => e.id === engine);
  const gpuLive = current?.status === "online";
  const durations = kind === "video" && gpuLive && current.durations?.length ? current.durations : cfg.durations;
  useEffect(() => { if (!durations.includes(duration)) setDuration(durations.includes(5) ? 5 : durations[0]); }, [durations, duration]);
  const etaText = kind === "video" && gpuLive ? fmtEta(current.eta_seconds) : cfg.eta(duration);

  const pickImage = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    try { setStartImage(await toJpegDataUrl(f)); } catch { toast.error("Could not read that image."); }
  };

  const poll = (id) => {
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/jobs/${id}`);
        setJob(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(timer.current);
          setBusy(false);
          if (data.status === "failed") toast.error(data.error || "Generation failed");
        }
      } catch (e) {
        clearInterval(timer.current);
        setBusy(false);
        toast.error(e?.response?.data?.detail || "Could not check job status");
      }
    }, 4000);
  };

  const start = async () => {
    if (!prompt.trim()) { toast.error("Please enter a prompt."); return; }
    setBusy(true);
    setJob(null);
    try {
      const body = kind === "video"
        ? { prompt: prompt.trim(), duration, style, model: engine, aspect_ratio: aspect, image_base64: startImage }
        : { prompt: prompt.trim(), duration, style };
      const { data } = await axios.post(`${API}/${kind}`, body, { headers: authHeader });
      setJob(data);
      poll(data.job_id);
    } catch (e) {
      setBusy(false);
      toast.error(e?.response?.data?.detail || "Request failed. Please try again.");
    }
  };

  const src = job?.url ? (job.url.startsWith("/api") ? `${BASE}${job.url}` : job.url) : null;
  const Icon = cfg.icon;
  const pending = job && (job.status === "queued" || job.status === "running");

  return (
    <div className="min-h-screen bg-[#05060A] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 md:px-8 pt-28 pb-24" data-testid={`${kind}-studio-page`}>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 mb-5">
          <Icon className="w-3.5 h-3.5 text-[#00F0FF]" /> {cfg.badge}
        </div>
        <h1 className="font-display font-bold tracking-tight text-4xl md:text-5xl">
          {cfg.title} <span className="text-[#00F0FF]">{cfg.accent}</span>
        </h1>
        <p className="mt-3 text-neutral-400 text-sm md:text-base">{cfg.sub}</p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 space-y-5">
          <Textarea data-testid={`${kind}-prompt-input`} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={cfg.placeholder} maxLength={500}
            className="min-h-[130px] bg-black/40 border-white/10 text-white resize-none focus-visible:ring-[#00F0FF]" />
          {kind === "video" && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} data-testid="video-start-image-input" />
              {startImage ? (
                <div className="flex items-center gap-3 rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF]/5 p-2.5" data-testid="video-start-image-preview">
                  <img src={startImage} alt="Start frame" className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1 text-xs text-neutral-300"><b className="text-white">Image-to-video</b><br />This photo becomes the first frame and gets animated.</div>
                  <button type="button" onClick={() => setStartImage(null)} data-testid="video-start-image-remove"
                    className="p-1.5 rounded-full hover:bg-white/10" aria-label="Remove start image"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} data-testid="video-start-image-btn"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/5 py-3 text-sm text-neutral-300">
                  <ImagePlus className="w-4 h-4 text-[#00F0FF]" /> Animate a photo (optional start image)
                </button>
              )}
            </div>
          )}
          {kind === "video" && startImage && (
            <PresetRow presets={PHOTO_MOTION_PRESETS} testid="video-motion" label="Photo motion" hint="one tap animates your photo"
              onPick={(p) => setPrompt(p.prompt)} />
          )}
          {kind === "video" && !startImage && (
            <PresetRow presets={TIKTOK} testid="video-tiktok" label="Trending" hint="TikTok-style · vertical 9:16"
              onPick={(p) => {
                const pick = p.surprise
                  ? (() => { const pool = SURPRISE_VIDEO_IDEAS.filter((i) => i.prompt !== prompt); return pool[Math.floor(Math.random() * pool.length)]; })()
                  : p;
                setPrompt(pick.prompt);
                if (pick.style) setStyle(pick.style);
                setAspect("9:16");
              }} />
          )}
          {!(kind === "video" && startImage) && (
            <PresetRow presets={PRESETS[kind]} testid={`${kind}-preset`}
              onPick={(p) => { setPrompt(p.prompt); if (p.style) setStyle(p.style); }} />
          )}
          {kind === "video" && <EnginePicker engines={engines} value={engine} onChange={setEngine} />}
          {kind === "video" && current && !gpuLive && (
            <p className="-mt-2 text-[11px] text-neutral-500" data-testid="video-engine-fallback-note">
              No {current.name} GPU is online right now, so this clip will render on Frasberg Lite (keyframe animation{startImage ? ", start image not used" : ""}).
            </p>
          )}
          {kind === "video" && (
            <div>
              <label className="text-sm font-medium text-neutral-300 mb-2 block">Format</label>
              <Chips kind={kind} name="aspect" options={ASPECTS} value={aspect} onChange={(v) => setAspect(v || "16:9")} />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-neutral-300 mb-2 block">Style</label>
            <Chips kind={kind} name="style" options={cfg.styles} value={style} onChange={setStyle} />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-300 mb-2 block">Length</label>
            <Chips kind={kind} name="duration" options={durations} value={duration} onChange={setDuration} render={(d) => `${d}s`} />
            <p className="mt-2 text-xs text-neutral-500" data-testid={`${kind}-eta`}>Takes {etaText} to render.</p>
          </div>
          <Button onClick={start} disabled={busy} data-testid={`${kind}-generate-btn`}
            className="w-full h-12 bg-[#00F0FF] text-black hover:bg-[#00d4de] font-semibold rounded-full text-base">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {job?.status === "queued" ? "Queued" : "Working"}…</>
              : <><Icon className="w-4 h-4 mr-2" /> Generate {kind}</>}
          </Button>

          {pending && <Progress kind={kind} job={job} eta={etaText} />}

          {src && (
            <div className="pt-2 space-y-3" data-testid={`${kind}-result`}>
              {kind === "video"
                ? <video src={src} controls autoPlay loop playsInline className={`rounded-xl border border-white/10 ${aspect === "9:16" ? "max-h-[70vh] mx-auto" : "w-full"}`} />
                : <audio src={src} controls autoPlay className="w-full" />}
              <p className="text-xs text-neutral-500" data-testid={`${kind}-result-meta`}>
                “{job.prompt}” · {job.style || "no style"} · {job.duration}s{job.engine ? ` · ${job.engine}` : ""}{job.mode === "image-to-video" ? " · image-to-video" : ""}
              </p>
              <a href={src} download={`luchii-${kind}-${job.job_id.slice(0, 8)}.${kind === "video" ? "mp4" : "wav"}`}
                data-testid={`${kind}-download-btn`}
                className="flex items-center justify-center w-full h-10 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm">
                <Download className="w-4 h-4 mr-2" /> Download
              </a>
              {kind === "video" && (
                <button type="button" onClick={() => shareVideo(job.job_id)} data-testid="video-share-btn"
                  className="flex items-center justify-center w-full h-10 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm">
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
