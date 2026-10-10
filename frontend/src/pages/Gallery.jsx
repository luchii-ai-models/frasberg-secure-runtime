import React, { useEffect, useMemo, useState } from "react";
import { LuchiiBadge, luchiiModelFor } from "../components/LuchiiBadge";
import { downloadWithLuchii } from "../lib/luchiiMark";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Sparkles, ArrowLeft, Download, ImageIcon, Loader2, Wand2, Share2, AudioLines, Box, Search, Clapperboard, RotateCcw, ExternalLink } from "lucide-react";
import { shareVideo, isPreviewEngine } from "./Studio";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { brand } from "../mock";
import { toast } from "sonner";
import "@google/model-viewer";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND}/api`;
const TABS = [
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Clapperboard },
  { id: "takes", label: "Voice takes", icon: AudioLines },
  { id: "models", label: "3D models", icon: Box },
];

function Empty({ text, to, cta }) {
  const navigate = useNavigate();
  return (
    <div className="grid place-items-center py-24 text-center" data-testid="gallery-empty">
      <p className="text-neutral-400">{text}</p>
      <Button onClick={() => navigate(to)} className="mt-4 bg-[#00F0FF] text-black hover:bg-[#00d4de] font-semibold rounded-full">{cta}</Button>
    </div>
  );
}

function TakesList({ takes }) {
  const [q, setQ] = useState("");
  const [voice, setVoice] = useState("all");
  const voices = useMemo(() => ["all", ...new Set(takes.map((t) => t.voice))], [takes]);
  const shown = takes.filter((t) => (voice === "all" || t.voice === voice) && t.text.toLowerCase().includes(q.trim().toLowerCase()));
  if (!takes.length) return <Empty text="No saved voice takes yet." to="/sts" cta="Open Speech to Speech" />;
  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row gap-3 md:items-center" data-testid="takes-filters">
        <div className="relative md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <Input data-testid="takes-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search what was said…"
            className="pl-9 bg-black/40 border-white/10 focus-visible:ring-[#00F0FF]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {voices.map((v) => (
            <button key={v} data-testid={`takes-voice-${v}`} onClick={() => setVoice(v)}
              className={`rounded-full px-3 py-1 text-xs border capitalize transition-colors ${voice === v ? "bg-[#00F0FF] text-black border-[#00F0FF] font-semibold" : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"}`}>
              {v === "clone" ? "My cloned voice" : v === "all" ? "All voices" : v}
            </button>
          ))}
        </div>
        <span className="md:ml-auto text-xs text-neutral-500" data-testid="takes-count">{shown.length} of {takes.length}</span>
      </div>
      {!shown.length && <p className="text-sm text-neutral-500 py-10 text-center" data-testid="takes-no-match">No takes match your search.</p>}
    <div className="grid md:grid-cols-2 gap-4" data-testid="gallery-takes">
      {shown.map((t) => (
        <div key={t.id} data-testid={`gallery-take-${t.id}`} className="rounded-xl border border-white/10 bg-[#1E2327] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#00F0FF]">{t.voice === "clone" ? "My cloned voice" : t.voice}</span>
            <a href={`${BACKEND}${t.audio_url}`} download className="text-white/70 hover:text-white" title="Download"><Download className="w-4 h-4" /></a>
          </div>
          <p className="text-sm text-neutral-300 line-clamp-2">“{t.text}”</p>
          <audio controls preload="none" src={`${BACKEND}${t.audio_url}`} className="w-full" />
        </div>
      ))}
    </div>
    </div>
  );
}

function VideoCard({ v }) {
  const ref = React.useRef(null);
  const src = `${BACKEND}${v.url}`;
  const replay = () => { const el = ref.current; if (el) { el.currentTime = 0; el.play().catch(() => {}); } };
  const aspect = v.aspect_ratio === "9:16" ? "aspect-[9/16]" : v.aspect_ratio === "1:1" ? "aspect-square" : "aspect-video";
  return (
    <div data-testid={`gallery-video-${v.id}`} className="rounded-xl border border-white/10 bg-[#1E2327] overflow-hidden flex flex-col">
      <div className={`relative bg-black ${aspect}`}>
        <video ref={ref} src={`${src}#t=0.1`} muted loop playsInline preload="metadata" controls
          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()}
          className="absolute inset-0 w-full h-full object-contain" data-testid={`gallery-video-player-${v.id}`} />
        <LuchiiBadge overlay model={videoModel(v)} className="!bottom-12" testId={`gallery-video-luchii-badge-${v.id}`} />
        <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#00F0FF]">
          {v.mode === "image-to-video" ? "Photo → video" : "Text → video"}
        </span>
        {isPreviewEngine(v.engine) && (
          <span data-testid={`gallery-video-preview-${v.id}`} className="absolute top-2 right-2 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-semibold text-black">Preview</span>
        )}
      </div>
      <div className="p-3 space-y-2 mt-auto">
        <p className="text-xs text-neutral-300 line-clamp-2" title={v.prompt}>{v.prompt}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-neutral-500 truncate">{v.duration}s · {v.aspect_ratio}</span>
          <div className="flex items-center gap-2.5 shrink-0">
            <button onClick={replay} title="Replay" data-testid={`gallery-video-replay-${v.id}`} className="text-white/70 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
            <button onClick={() => shareVideo(v.id)} title="Share" data-testid={`gallery-video-share-${v.id}`} className="text-white/70 hover:text-white"><Share2 className="w-4 h-4" /></button>
            <a href={`${src}/download`} download={`luchii-video-${v.id.slice(0, 8)}.mp4`} title="Download" data-testid={`gallery-video-download-${v.id}`} className="text-white/70 hover:text-white"><Download className="w-4 h-4" /></a>
            <Link to={`/v/${v.id}`} title="Open" data-testid={`gallery-video-open-${v.id}`} className="text-white/70 hover:text-white"><ExternalLink className="w-4 h-4" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelFilter({ options, value, onChange }) {
  if (options.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-5" data-testid="gallery-model-filter">
      {["All", ...options].map((m) => (
        <button key={m} onClick={() => onChange(m)} data-testid={`gallery-model-filter-${m.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
          className={`inline-flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-xs border transition-colors ${value === m
            ? "bg-[#00F0FF]/15 border-[#00F0FF]/60 text-white" : "border-white/10 bg-white/5 text-neutral-400 hover:text-white"}`}>
          {m === "All" ? <span className="w-5 h-5 grid place-items-center">·</span> : <img src={brand.luchiiLogo} alt="" className="w-5 h-5 rounded-full object-contain" />}
          {m}
        </button>
      ))}
    </div>
  );
}

const useModelFilter = (list, modelOf) => {
  const [model, setModel] = useState("All");
  const options = useMemo(() => [...new Set(list.map(modelOf))].sort(), [list]); // eslint-disable-line
  const active = options.includes(model) ? model : "All";
  const shown = active === "All" ? list : list.filter((x) => modelOf(x) === active);
  return { model: active, setModel, options, shown };
};

const videoModel = (v) => luchiiModelFor("video", null, v.mode, v.luchii_model);
const imageModel = (g) => luchiiModelFor(g.kind, g.style, null, g.model);

function VideosList({ videos }) {
  const f = useModelFilter(videos, videoModel);
  if (!videos.length) return <Empty text="No Frasberg Motion clips yet." to="/video" cta="Open Video Creator" />;
  return (
    <>
    <ModelFilter options={f.options} value={f.model} onChange={f.setModel} />
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start" data-testid="gallery-videos">
      {f.shown.map((v) => <VideoCard key={v.id} v={v} />)}
    </div>
    </>
  );
}

function ModelsList({ models }) {
  const done = models.filter((m) => m.status === "completed");
  if (!done.length) return <Empty text="No 3D models yet." to="/3d" cta="Open 3D Studio" />;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="gallery-models">
      {done.map((m) => (
        <div key={m.id} data-testid={`gallery-model-${m.id}`} className="rounded-xl border border-white/10 bg-[#1E2327] overflow-hidden">
          <model-viewer src={`${BACKEND}${m.model_url}`} alt={m.prompt} camera-controls auto-rotate
            style={{ width: "100%", height: "220px", background: "#11161A" }} />
          <div className="p-3 flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-300 line-clamp-1">{m.prompt}</p>
            <a href={`${BACKEND}${m.model_url}`} download className="text-white/70 hover:text-white" title="Download .glb"><Download className="w-4 h-4" /></a>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Gallery() {
  const { user, loading, authHeader } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState("images");
  const [takes, setTakes] = useState([]);
  const [models, setModels] = useState([]);
  const [videos, setVideos] = useState([]);
  const imgFilter = useModelFilter(items, imageModel);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/"); return; }
    const load = async () => {
      try {
        const [res, tk, md, vd] = await Promise.all([
          axios.get(`${API}/my/generations`, { headers: authHeader, params: { limit: 60 } }),
          axios.get(`${API}/voice/takes`, { headers: authHeader }).catch(() => ({ data: [] })),
          axios.get(`${API}/3d`, { headers: authHeader, params: { limit: 60 } }).catch(() => ({ data: [] })),
          axios.get(`${API}/videos`, { headers: authHeader, params: { limit: 60 } }).catch(() => ({ data: [] })),
        ]);
        setVideos(vd.data);
        setItems(res.data);
        setTakes(tk.data);
        setModels(md.data);
      } catch (e) {
        // ignore
      } finally {
        setBusy(false);
      }
    };
    load();
  }, [user, loading]); // eslint-disable-line

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 bg-[#12171B]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={brand.logo} alt="Frasberg Creator logo" className="w-9 h-9 rounded-full object-contain" />
            <span className="font-display text-lg font-bold">Frasberg Creator</span>
          </Link>
          <Link to="/create" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to create
          </Link>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">My gallery</h1>
            <p className="text-sm text-neutral-500 mt-1">Everything you've created with Frasberg Creator.</p>
          </div>
          <Button onClick={() => navigate("/create")}
            className="bg-[#00F0FF] text-black hover:bg-[#00d4de] font-semibold rounded-full">
            <Wand2 className="w-4 h-4 mr-2" /> Create new
          </Button>
        </div>

        <div className="flex gap-2 mb-6" data-testid="gallery-tabs">
          {TABS.map((t) => (
            <button key={t.id} data-testid={`gallery-tab-${t.id}`} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm border transition-colors ${tab === t.id
                ? "bg-[#00F0FF] text-black border-[#00F0FF] font-semibold" : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {!busy && tab === "videos" ? <VideosList videos={videos} /> : !busy && tab === "takes" ? <TakesList takes={takes} /> : !busy && tab === "models" ? <ModelsList models={models} /> : busy ? (
          <div className="grid place-items-center py-32 text-neutral-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#00F0FF]" />
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center py-32 text-center">
            <ImageIcon className="w-12 h-12 text-neutral-700 mb-4" />
            <p className="text-neutral-400">No creations yet.</p>
            <Button onClick={() => navigate("/create")}
              className="mt-4 bg-[#00F0FF] text-black hover:bg-[#00d4de] font-semibold rounded-full">
              Start creating
            </Button>
          </div>
        ) : (
          <>
          <ModelFilter options={imgFilter.options} value={imgFilter.model} onChange={imgFilter.setModel} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="gallery-images">
            {imgFilter.shown.map((g) => (
              <div key={g.id} className="group relative rounded-xl overflow-hidden border border-white/10 bg-[#1E2327]">
                <img src={g.image_base64} alt={g.prompt} className="w-full aspect-square object-cover" />
                <LuchiiBadge overlay model={imageModel(g)} className="!top-2 !bottom-auto" testId={`gallery-luchii-badge-${g.id}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 inset-x-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-neutral-200 line-clamp-2">{g.prompt}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] uppercase tracking-wide text-[#00F0FF]">{g.style}</span>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/s/${g.id}`);
                          toast.success("Share link copied!");
                        }}
                        className="text-white/80 hover:text-white" title="Copy share link">
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button onClick={async () => {
                          let src = g.image_base64;
                          if (g.has_full) { // list shows a light preview of HD/4K images; download the full file
                            try { src = (await axios.get(`${API}/share/${g.id}`)).data.image_base64 || src; } catch (_) { /* use preview */ }
                          }
                          downloadWithLuchii(src, `frasberg-creator-${g.id.slice(0, 8)}.${g.has_full ? "jpg" : "png"}`, luchiiModelFor(g.kind, g.style, null, g.model));
                        }}
                        data-testid={`gallery-download-${g.id}`} className="text-white/80 hover:text-white" title="Download">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
