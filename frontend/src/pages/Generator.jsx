import React, { useState, useEffect, useRef, useCallback } from "react";
import { LuchiiBadge, luchiiModelFor } from "../components/LuchiiBadge";
import { downloadWithLuchii } from "../lib/luchiiMark";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  Wand2, Download, Loader2, ImageIcon, ArrowLeft, Dice5, X, Maximize2, LayoutGrid, Share2,
  SplitSquareHorizontal, CheckCircle2, Shuffle, Scissors, Type, Upload, Paperclip, ArrowUp,
} from "lucide-react";
import { toast } from "sonner";
import { brand } from "../mock";
import { useAuth } from "../context/AuthContext";
import LogoLoader from "../components/LogoLoader";
import RenderProgress from "../components/RenderProgress";
import { TEXT_PRESETS, REMIX_PRESETS, surprisePrompt, rotatePresets } from "../lib/promptKit";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STYLES = [
  { id: "auto", label: "Auto style" },
  { id: "photorealistic", label: "Photoreal" },
  { id: "cinematic", label: "Cinematic" },
  { id: "3d", label: "3D Render" },
  { id: "anime", label: "Anime" },
  { id: "digital-art", label: "Digital Art" },
  { id: "product", label: "Product" },
];
const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const TOOLS = { upscale: "Upscale to 4K", "remove-bg": "Remove background", edit: "Remix photo" };

function getSessionId() {
  let sid = localStorage.getItem("luchii_session");
  if (!sid) {
    sid = (crypto.randomUUID && crypto.randomUUID()) || `s-${Date.now()}-${Math.random()}`;
    localStorage.setItem("luchii_session", sid);
  }
  return sid;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Image work runs as a server job (local renders take minutes) and is polled until done.
async function runImageJob(path, body, headers, onQueued) {
  const { data } = await axios.post(`${API}${path}/jobs`, body, { headers });
  for (;;) {
    await sleep(2500);
    let s;
    try {
      s = (await axios.get(`${API}/image-jobs/${data.job_id}`)).data;
    } catch (e) {
      if (e?.response?.status === 404) throw e;
      continue; // transient network/gateway hiccup: keep polling
    }
    onQueued(s.status === "queued");
    if (s.status === "completed") return { data: s.result };
    if (s.status === "failed") {
      const err = new Error(s.error || "Generation failed");
      err.response = { data: { detail: s.error || "Generation failed. Please try again." } };
      throw err;
    }
  }
}

const toDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(blob);
});

// Built-in model choice (mirrors backend auto_model) so the result badge and hint are right.
const ART = /\b(anime|manga|cartoon|illustration|painting|painterly|watercolou?r|sketch|pixel art|vector|logo|icon|comic)\b/i;
const RENDER = /\b(3d|render|octane|concept art|isometric|low poly|sculpture|claymation)\b/i;
const autoModel = (p, s) => (ART.test(p) ? "Luchii Dreamline"
  : RENDER.test(p) && s !== "photorealistic" ? "Luchii Vision"
  : ({ anime: "Luchii Dreamline", "digital-art": "Luchii Dreamline", "3d": "Luchii Vision" })[s] || "Luchii Nova-Muse");

export default function Generator() {
  const { user, authHeader } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("auto");
  const [aspect, setAspect] = useState("1:1");
  const [refImage, setRefImage] = useState(null); // attached photo => remix / upscale / cutout
  const [refPrompt, setRefPrompt] = useState(null); // prompt of a showcase image that was opened
  const [tool, setTool] = useState(null); // upscale | remove-bg | edit (from homepage tools)
  const [busy, setBusy] = useState(null); // null | generate | remix | upscale | cutout
  const [queued, setQueued] = useState(false);
  const [image, setImage] = useState(null);
  const [resultId, setResultId] = useState(null);
  const [resultModel, setResultModel] = useState("Luchii Nova-Muse");
  const [history, setHistory] = useState([]);
  const [beforeImage, setBeforeImage] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [dims, setDims] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState("text"); // text | image (the original two-tab template)
  const remix = mode === "image" && !!refImage;
  const [chips, setChips] = useState(() => rotatePresets(TEXT_PRESETS, 5));
  const chipsPaused = useRef(false);
  const is4k = dims && Math.max(dims.w, dims.h) >= 3800;
  const [resultKind, setResultKind] = useState(null);
  const isCutout = resultKind === "cutout";

  const markQueued = (q) => setQueued(q);

  // Presets live inside the composer and keep rotating so creators always see new ideas.
  useEffect(() => {
    const pool = mode === "image" ? REMIX_PRESETS : TEXT_PRESETS;
    setChips((c) => rotatePresets(pool, 5, c.map((x) => x.id)));
    const t = setInterval(() => {
      if (!chipsPaused.current) setChips((c) => rotatePresets(pool, 5, c.map((x) => x.id)));
    }, 7000);
    return () => clearInterval(t);
  }, [mode]);

  const attachFromUrl = useCallback(async (url) => {
    try {
      const blob = await (await fetch(url)).blob();
      setRefImage(await toDataUrl(blob));
      setMode("image");
    } catch (_) {
      toast.error("Could not load that image.");
    }
  }, []);

  // Deep links from the homepage: ?tool=upscale|remove-bg|edit, ?ref=<image>, ?prompt=, ?style=, ?aspect=
  useEffect(() => {
    const t = searchParams.get("tool");
    const legacyMode = searchParams.get("mode");
    const tl = TOOLS[t] ? t : legacyMode === "image" ? "edit" : null;
    setTool(tl);
    if (tl) setMode("image");
    const p = searchParams.get("prompt") || searchParams.get("preset");
    const st = searchParams.get("style");
    const ar = searchParams.get("aspect");
    const ref = searchParams.get("ref");
    if (st && STYLES.some((s) => s.id === st)) setStyle(st);
    if (ar && ASPECTS.includes(ar)) setAspect(ar);
    if (ref) {
      attachFromUrl(ref);
      setRefPrompt(p || null);
      setPrompt("");
    } else if (p) setPrompt(p);
  }, [searchParams, attachFromUrl]);

  useEffect(() => {
    axios.get(`${API}/generations`, { params: { session_id: getSessionId(), limit: 8 } })
      .then((res) => setHistory(res.data.map((g) => ({
        id: g.id, url: g.image_base64, hasFull: !!g.has_full, prompt: g.prompt, kind: g.kind,
        model: luchiiModelFor(g.kind, g.style, null, g.model),
      }))))
      .catch(() => { /* non-critical */ });
  }, []);

  const openHistory = async (h) => {
    setBeforeImage(null); setResultId(h.id); setResultModel(h.model || "Luchii Nova-Muse"); setResultKind(h.kind || null);
    setImage(h.url);
    if (h.hasFull) { // lists carry a light preview of HD/4K images; load the full file
      try {
        const { data } = await axios.get(`${API}/share/${h.id}`);
        if (data?.image_base64) setImage(data.image_base64);
      } catch (_) { /* keep the preview */ }
    }
  };

  const handleShare = async () => {
    if (!resultId) return;
    const link = `${window.location.origin}/s/${resultId}`;
    try {
      if (navigator.share) await navigator.share({ title: "My Frasberg Creator creation", url: link });
      else { await navigator.clipboard.writeText(link); toast.success("Share link copied to clipboard!"); }
    } catch (e) {
      try { await navigator.clipboard.writeText(link); toast.success("Share link copied to clipboard!"); } catch (_) { /* ignore */ }
    }
  };

  const readFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please attach an image file."); return; }
    setRefImage(await toDataUrl(file));
    setMode("image");
    setRefPrompt(null);
    inputRef.current?.focus();
  };

  const finish = (res, label, before = null) => {
    const url = res.data.image_base64;
    setImage(url);
    setResultId(res.data.id);
    setBeforeImage(before);
    const model = luchiiModelFor(res.data.kind, res.data.style, null, res.data.model);
    setResultModel(model);
    setResultKind(res.data.kind || null);
    setHistory((h) => [{ id: res.data.id, url, prompt: label, model, kind: res.data.kind }, ...h].slice(0, 8));
  };

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
      setQueued(false);
    }
  };

  const handleGenerate = () => {
    if (busy) return;
    if (mode === "image" && !refImage) {
      toast.error("Upload a photo first.");
      fileRef.current?.click();
      return;
    }
    if (remix && tool === "upscale") return handleUpscale(refImage);
    if (remix && tool === "remove-bg") return handleCutout(refImage);
    if (!prompt.trim()) {
      toast.error(remix ? "Describe how to change your photo." : "Describe the image you want.");
      inputRef.current?.focus();
      return;
    }
    if (remix) {
      const src = refImage;
      return run("remix", async () => {
        const res = await runImageJob("/edit", {
          prompt: prompt.trim(), image_base64: src, session_id: getSessionId(), style: style === "auto" ? null : style,
        }, authHeader, markQueued);
        finish(res, prompt.trim(), src);
        toast.success("Remix ready!");
      });
    }
    return run("generate", async () => {
      setImage(null);
      const res = await runImageJob("/generate", {
        prompt: prompt.trim(), style: style === "auto" ? null : style, aspect_ratio: aspect, session_id: getSessionId(), quality: "full",
      }, authHeader, markQueued);
      finish(res, prompt.trim());
      toast.success(user ? "Saved to your gallery!" : "Image ready!");
    });
  };

  const handleUpscale = (src = image) => {
    if (!src || busy) return;
    run("upscale", async () => {
      const res = await runImageJob("/upscale", { image_base64: src, session_id: getSessionId(), prompt: "Upscaled to 4K" }, authHeader, markQueued);
      finish({ data: { ...res.data, model: "Luchii Prime" } }, "Upscaled to 4K", src === image ? null : src);
      toast.success("Upscaled to 4K!");
    });
  };

  const handleCutout = (src = image) => {
    if (!src || busy) return;
    run("cutout", async () => {
      const res = await runImageJob("/remove-bg", { image_base64: src, session_id: getSessionId() }, authHeader, markQueued);
      finish(res, "Background removed", src);
      toast.success("Background removed!");
    });
  };

  const pickChip = (p) => {
    setPrompt(p.prompt);
    if (p.style) setStyle(p.style);
    if (!remix && p.aspect) setAspect(p.aspect);
    setChips((c) => rotatePresets(mode === "image" ? REMIX_PRESETS : TEXT_PRESETS, 5, [...c.map((x) => x.id), p.id]));
    inputRef.current?.focus();
  };

  const useRefPrompt = () => {
    setRefImage(null);
    setPrompt(refPrompt);
    setRefPrompt(null);
    setTool(null);
    setMode("text");
  };

  const eta = { generate: autoModel(prompt, style) === "Luchii Nova-Muse" ? 140 : 45, remix: 190, upscale: 160, cutout: 15 }[busy] || 60;
  const action = mode === "image" ? (tool === "upscale" ? "Upscale to 4K" : tool === "remove-bg" ? "Remove background" : "Remix") : "Generate";
  const placeholder = remix
    ? tool === "upscale" ? "Ready to upscale your photo to 4K. Press the arrow."
      : tool === "remove-bg" ? "Ready to remove the background. Press the arrow."
      : "Describe the change, like “make it a snowy winter night”..."
    : tool === "upscale" ? "Attach a photo to upscale it to 4K..."
      : tool === "remove-bg" ? "Attach a photo to remove its background..."
      : tool === "edit" ? "Attach a photo to remix it, then describe the change..."
      : "Describe the image you want to create...";

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 bg-[#12171B]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={brand.logo} alt="Frasberg Creator logo" className="w-9 h-9 rounded-full object-contain" />
            <span className="font-display text-lg font-bold">Frasberg Creator</span>
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <button onClick={() => navigate("/gallery")} className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
                <LayoutGrid className="w-4 h-4" /> My gallery
              </button>
            )}
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-5 md:px-8 py-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="font-display text-2xl font-bold">AI Image Generator</h1>
          <p className="text-sm text-neutral-500">Type an idea, or attach a photo to remix, upscale or cut out.</p>
        </div>

        <div data-testid="result-canvas"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
          className={`rounded-2xl border bg-[#1E2327] aspect-[4/3] md:aspect-video grid place-items-center overflow-hidden relative isolate ${dragOver ? "border-[#00F0FF]" : "border-white/10"}`}>
          {busy ? (
            <>
              {(image || refImage) && (
                <img src={busy === "generate" ? image || refImage : refImage || image} alt="" aria-hidden
                  className="absolute inset-0 -z-10 w-full h-full object-cover scale-110 blur-2xl opacity-35" />
              )}
              <div data-testid={queued ? "image-queue-notice" : busy === "upscale" ? "upscale-loading" : "image-loading"} className="flex flex-col items-center">
                <LogoLoader label={queued ? "In the queue" : action} />
                <RenderProgress queued={queued} eta={eta} testId={busy === "upscale" ? "upscale-progress" : "render-progress"} />
              </div>
            </>
          ) : image ? (
            <>
              <img src={image} alt="" aria-hidden className="absolute inset-0 -z-10 w-full h-full object-cover scale-110 blur-2xl opacity-30" />
              <img data-testid="result-image" src={comparing && beforeImage ? beforeImage : image} alt="Generated"
                onLoad={(e) => !comparing && setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className={`w-full h-full object-contain ${isCutout ? "bg-[conic-gradient(#2a3035_25%,#1f2428_0_50%,#2a3035_0_75%,#1f2428_0)] bg-[length:24px_24px]" : ""}`} />
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                {comparing && beforeImage && (
                  <span data-testid="compare-before-label" className="rounded-full bg-black/75 backdrop-blur px-3 py-1 text-[11px] font-semibold tracking-wide">ORIGINAL</span>
                )}
                <LuchiiBadge model={resultModel} testId="result-luchii-badge" className="!max-w-none" />
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-2 p-3 sm:p-4 bg-gradient-to-t from-black/75 via-black/30 to-transparent pt-10">
                <div className="flex items-center gap-2">
                  {dims && (
                    <span data-testid="result-resolution" className="inline-flex items-center rounded-full bg-black/70 backdrop-blur px-3 py-1.5 text-[11px] font-semibold tabular-nums">
                      {is4k ? "4K" : Math.max(dims.w, dims.h) >= 1800 ? "2K" : Math.max(dims.w, dims.h) >= 1000 ? "HD" : "SD"} · {dims.w}×{dims.h}
                    </span>
                  )}
                  {beforeImage && (
                    <button data-testid="compare-btn" type="button"
                      onMouseDown={() => setComparing(true)} onMouseUp={() => setComparing(false)} onMouseLeave={() => setComparing(false)}
                      onTouchStart={() => setComparing(true)} onTouchEnd={() => setComparing(false)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-3.5 py-1.5 text-xs font-medium hover:bg-black select-none">
                      <SplitSquareHorizontal className="w-3.5 h-3.5" /> Hold to compare
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button data-testid="remix-result-btn" onClick={() => { setRefImage(image); setMode("image"); setRefPrompt(null); setTool("edit"); setPrompt(""); inputRef.current?.focus(); }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-4 py-2 text-sm font-medium hover:bg-black">
                    <Wand2 className="w-4 h-4" /> Remix
                  </button>
                  <button data-testid="upscale-btn" onClick={() => handleUpscale(image)} disabled={!!busy || is4k}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#00F0FF] text-black px-4 py-2 text-sm font-semibold hover:bg-[#00d4de] disabled:opacity-60">
                    {is4k ? (<><CheckCircle2 className="w-4 h-4" /> 4K ready</>) : (<><Maximize2 className="w-4 h-4" /> Upscale to 4K</>)}
                  </button>
                  <button onClick={handleShare} data-testid="result-share-btn"
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-4 py-2 text-sm font-medium hover:bg-black">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button data-testid="result-download-btn"
                    onClick={() => downloadWithLuchii(image, isCutout ? "frasberg-cutout.png" : is4k ? "frasberg-creator-4k.jpg" : "frasberg-creator.jpg", resultModel)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-4 py-2 text-sm font-medium hover:bg-black">
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>
            </>
          ) : mode === "image" && refImage ? (
            <>
              <img src={refImage} alt="" aria-hidden className="absolute inset-0 -z-10 w-full h-full object-cover scale-110 blur-2xl opacity-30" />
              <img data-testid="attached-preview" src={refImage} alt="Your photo" className="w-full h-full object-contain" />
              <span className="absolute top-4 left-4 rounded-full bg-black/70 backdrop-blur px-3 py-1 text-[11px] font-semibold tracking-wide">YOUR PHOTO</span>
            </>
          ) : (
            <button type="button" onClick={() => (tool ? fileRef.current?.click() : inputRef.current?.focus())}
              className="flex flex-col items-center gap-3 text-neutral-500 hover:text-neutral-300">
              <ImageIcon className="w-10 h-10" />
              <p className="text-sm">{tool ? `Drop or attach a photo to ${TOOLS[tool].toLowerCase()}` : "Your image will appear here · drop a photo to remix it"}</p>
            </button>
          )}
        </div>

        {/* Composer: prompt, presets, photo, style and size all built into one input */}
        <div data-testid="composer" className="rounded-3xl border border-white/10 bg-[#1E2327]/95 backdrop-blur p-3 shadow-2xl shadow-black/40 focus-within:border-[#00F0FF]/50 transition-colors">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none]"
            onMouseEnter={() => { chipsPaused.current = true; }} onMouseLeave={() => { chipsPaused.current = false; }}>
            {chips.map((p) => (
              <button key={p.id} type="button" data-testid={`preset-chip-${p.id}`} onClick={() => pickChip(p)}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/10 hover:text-white transition-colors animate-in fade-in duration-500">
                {p.label}
              </button>
            ))}
            <button type="button" data-testid="preset-shuffle" title="More ideas"
              onClick={() => setChips((c) => rotatePresets(mode === "image" ? REMIX_PRESETS : TEXT_PRESETS, 5, c.map((x) => x.id)))}
              className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-neutral-500 hover:text-[#00F0FF]">
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>

          {(refImage || tool) && (
            <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
              {refImage ? (
                <div data-testid="attached-image" className="relative">
                  <img src={refImage} alt="attached" className="h-14 w-14 rounded-xl object-cover border border-white/10" />
                  <button type="button" data-testid="attached-remove" onClick={() => { setRefImage(null); setRefPrompt(null); setMode("text"); setTool(null); }}
                    className="absolute -top-1.5 -right-1.5 grid place-items-center w-5 h-5 rounded-full bg-black border border-white/20 hover:bg-neutral-800">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button type="button" data-testid="attach-big" onClick={() => fileRef.current?.click()}
                  className="h-14 w-14 rounded-xl border border-dashed border-white/20 grid place-items-center text-neutral-400 hover:border-[#00F0FF]/60 hover:text-white">
                  <Upload className="w-4 h-4" />
                </button>
              )}
              {[{ id: "edit", icon: Wand2, label: "Remix" }, { id: "upscale", icon: Maximize2, label: "Upscale 4K" }, { id: "remove-bg", icon: Scissors, label: "Remove BG" }].map((t) => {
                const on = (tool || "edit") === t.id;
                return (
                  <button key={t.id} type="button" data-testid={`tool-${t.id}`} onClick={() => { setTool(t.id); setMode("image"); }} aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${on ? "bg-[#00F0FF] text-black border-[#00F0FF]" : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"}`}>
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
              {refPrompt && (
                <button type="button" data-testid="use-ref-prompt" onClick={useRefPrompt}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10">
                  <Type className="w-3.5 h-3.5" /> Create a new one from its prompt
                </button>
              )}
            </div>
          )}

          <textarea ref={inputRef} data-testid="prompt-input" value={prompt} rows={2}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
            disabled={remix && (tool === "upscale" || tool === "remove-bg")}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-relaxed placeholder:text-neutral-500 focus:outline-none disabled:opacity-60 min-h-[56px] max-h-48" />

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button type="button" data-testid="attach-btn" onClick={() => fileRef.current?.click()} title="Attach a photo to remix, upscale or cut out"
              className="grid place-items-center w-9 h-9 rounded-full text-neutral-400 hover:text-white hover:bg-white/10">
              <Paperclip className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" data-testid="attach-input" className="hidden"
              onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" data-testid="surprise-btn"
              onClick={() => { setPrompt(surprisePrompt(mode, style === "auto" ? "cinematic" : style)); inputRef.current?.focus(); }}
              className="inline-flex items-center gap-1.5 h-9 rounded-full px-3 text-xs font-medium text-[#00F0FF] hover:bg-white/10">
              <Dice5 className="w-4 h-4" /> Surprise me
            </button>
            <select data-testid="style-select" value={style} onChange={(e) => setStyle(e.target.value)}
              className="h-8 rounded-full border border-white/10 bg-black/30 px-3 text-xs text-neutral-200 focus:outline-none focus:border-[#00F0FF]/60">
              {STYLES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
            {mode === "text" && (
              <select data-testid="aspect-select" value={aspect} onChange={(e) => setAspect(e.target.value)}
                className="h-8 rounded-full border border-white/10 bg-black/30 px-3 text-xs text-neutral-200 focus:outline-none focus:border-[#00F0FF]/60">
                {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <span data-testid="auto-model-hint" className="hidden sm:inline text-[11px] text-neutral-500 ml-1 truncate">
              {mode === "image" ? (tool === "upscale" || tool === "remove-bg" ? "Luchii Prime" : "Luchii Painter-X") : autoModel(prompt, style)}
            </span>
            <button type="button" data-testid="generate-btn" onClick={handleGenerate} disabled={!!busy} title={action}
              className="ml-auto inline-flex items-center gap-2 h-10 rounded-full bg-[#00F0FF] text-black pl-4 pr-3 text-sm font-semibold hover:bg-[#00d4de] disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? "Working..." : action}
              {!busy && <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {!user && <p className="text-xs text-neutral-500 text-center">Log in to save every creation to your private gallery.</p>}

        {history.length > 0 && (
          <div className="pt-2">
            <h3 className="text-sm font-medium mb-3 text-neutral-400">Recent generations</h3>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {history.map((h, i) => (
                <button key={`${h.id}-${i}`} onClick={() => openHistory(h)} data-testid={`history-item-${i}`}
                  className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-[#00F0FF]/50">
                  <img src={h.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
