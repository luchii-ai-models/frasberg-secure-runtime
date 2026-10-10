import React, { useState, useEffect, useRef } from "react";
import { LuchiiBadge, luchiiModelFor, LUCHII_PICKER } from "../components/LuchiiBadge";
import { downloadWithLuchii } from "../lib/luchiiMark";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  Sparkles, Wand2, Download, Loader2, ImageIcon, ArrowLeft, Dice5,
  Upload, X, Maximize2, LayoutGrid, Type, Images, Share2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { genStyles, genAspects, promptSuggestions, brand } from "../mock";
import { PresetRow } from "../components/PresetRow";
import { IMAGE_PRESETS } from "../presets";
import { useAuth } from "../context/AuthContext";
import LogoLoader from "../components/LogoLoader";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function getSessionId() {
  let sid = localStorage.getItem("luchii_session");
  if (!sid) {
    sid = (crypto.randomUUID && crypto.randomUUID()) || `s-${Date.now()}-${Math.random()}`;
    localStorage.setItem("luchii_session", sid);
  }
  return sid;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Image work runs as a server job (photoreal renders take ~2 min) and is polled until done.
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

export default function Generator() {
  const { user, authHeader } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef(null);

  const [mode, setMode] = useState("text"); // 'text' | 'image'
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [aspect, setAspect] = useState("1:1");
  const [refImage, setRefImage] = useState(null); // data URL of uploaded reference
  const [loading, setLoading] = useState(false);
  const [upscaling, setUpscaling] = useState(false);
  const [queued, setQueued] = useState(false);
  const markQueued = (q) => {
    setQueued((prev) => {
      if (q && !prev) toast("Your image is in the queue", { description: "Frasberg Creator is finishing another image. Yours starts next." });
      return q;
    });
  };
  const [image, setImage] = useState(null);
  const [resultId, setResultId] = useState(null);
  const [resultModel, setResultModel] = useState("Luchii Nova-Muse");
  const [pickModel, setPickModel] = useState(() => LUCHII_PICKER.text.some((m) => m.name === searchParams.get("model")) ? searchParams.get("model") : "Luchii Nova-Muse");
  const [history, setHistory] = useState([]);
  const [draftMode, setDraftMode] = useState(true); // Nova-Muse quick preview (<1 min) before the full render
  const [lastDraft, setLastDraft] = useState(null); // {prompt, style, aspect_ratio, model, seed} of the shown draft
  const [renderingFull, setRenderingFull] = useState(false);

  // Apply tool preset from URL (?mode=text|image&preset=...)
  useEffect(() => {
    const m = searchParams.get("mode");
    const preset = searchParams.get("preset");
    if (m === "image" || m === "text") setMode(m);
    if (preset) setPrompt(preset);
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/generations`, {
          params: { session_id: getSessionId(), limit: 8 },
        });
        setHistory(res.data.map((g) => ({ id: g.id, url: g.image_base64, prompt: g.prompt, model: luchiiModelFor(g.kind, g.style, null, g.model) })));
      } catch (e) { /* non-critical */ }
    };
    load();
  }, []);

  const shareLink = (id) => `${window.location.origin}/s/${id}`;

  const handleShare = async () => {
    if (!resultId) return;
    const link = shareLink(resultId);
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Frasberg Creator creation", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        toast.success("Share link copied to clipboard!");
      }
    } catch (e) {
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Share link copied to clipboard!");
      } catch (_) { /* ignore */ }
    }
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setRefImage(reader.result);
    reader.readAsDataURL(file);
  };

  const isNova = mode === "text" && pickModel === "Luchii Nova-Muse";

  const showResult = (res, usedPrompt) => {
    const url = res.data.image_base64;
    setImage(url);
    setResultId(res.data.id);
    const model = luchiiModelFor(res.data.kind, res.data.style, null, res.data.model);
    setResultModel(model);
    setHistory((h) => [{ id: res.data.id, url, prompt: usedPrompt, model }, ...h].slice(0, 8));
    setLastDraft(res.data.quality === "draft" ? {
      prompt: res.data.prompt, style: res.data.style, aspect_ratio: res.data.aspect_ratio, model: res.data.model, seed: res.data.seed,
    } : null);
  };

  const handleFullRender = async () => {
    if (!lastDraft) return;
    setRenderingFull(true);
    setLoading(true);
    try {
      const res = await runImageJob("/generate", { ...lastDraft, quality: "full", session_id: getSessionId() }, authHeader, markQueued);
      showResult(res, lastDraft.prompt);
      toast.success("Full-quality render ready!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Full render failed. Please try again.");
    } finally {
      setLoading(false);
      setRenderingFull(false);
      setQueued(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt.");
      return;
    }
    if (mode === "image" && !refImage) {
      toast.error("Please upload a reference image for image-to-image.");
      return;
    }
    setLoading(true);
    setImage(null);
    try {
      let res;
      if (mode === "image") {
        res = await runImageJob("/edit",
          { prompt, image_base64: refImage, session_id: getSessionId() }, authHeader, markQueued);
      } else {
        res = await runImageJob("/generate",
          { prompt, style, aspect_ratio: aspect, model: pickModel, session_id: getSessionId(),
            ...(isNova ? { quality: draftMode ? "draft" : "full" } : {}) }, authHeader, markQueued);
      }
      showResult(res, prompt);
      toast.success(user ? "Saved to your gallery!" : "Image generated with Frasberg Creator!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
      setQueued(false);
    }
  };

  const handleUpscale = async () => {
    if (!image) return;
    setUpscaling(true);
    try {
      const res = await runImageJob("/upscale",
        { image_base64: image, session_id: getSessionId(), prompt: prompt || "Upscaled" }, authHeader, markQueued);
      const url = res.data.image_base64;
      setImage(url);
      setResultId(res.data.id);
      setResultModel("Luchii Prime");
      setLastDraft(null);
      setHistory((h) => [{ id: res.data.id, url, prompt: "Upscaled to 4K", model: "Luchii Prime" }, ...h].slice(0, 8));
      toast.success("Enhanced & upscaled (AI 4K re-render)!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upscale failed. Please try again.");
    } finally {
      setUpscaling(false);
      setQueued(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 bg-[#12171B]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={brand.logo} alt="Frasberg Creator logo" className="w-9 h-9 rounded-full object-contain" />
            <span className="font-display text-lg font-bold">
              Frasberg Creator
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <button onClick={() => navigate("/gallery")}
                className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
                <LayoutGrid className="w-4 h-4" /> My gallery
              </button>
            )}
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-8 grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Controls */}
        <div className="space-y-5 lg:order-2">
          <div>
            <h1 className="font-display text-2xl font-bold">AI Image Generator</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Describe it or remix a photo. Frasberg Creator brings it to life.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full border border-white/10 bg-white/5">
            {[
              { id: "text", label: "Text to Image", icon: Type },
              { id: "image", label: "Image to Image", icon: Images },
            ].map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors ${
                  mode === m.id ? "bg-[#00F0FF] text-black" : "text-neutral-300 hover:text-white"
                }`}>
                <m.icon className="w-4 h-4" /> {m.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1E2327] p-5 space-y-5">
            <div data-testid="luchii-model-picker">
              <label className="text-sm font-medium mb-2 block">Luchii model</label>
              <div className="grid grid-cols-1 gap-1.5">
                {LUCHII_PICKER[mode].map((m) => {
                  const on = mode === "image" || pickModel === m.name;
                  return (
                    <button key={m.name} type="button" onClick={() => mode === "text" && setPickModel(m.name)}
                      data-testid={`luchii-model-${m.name.split(" ")[1].toLowerCase()}`} aria-pressed={on}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${on
                        ? "border-[#00F0FF]/70 bg-[#00F0FF]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                      <img src={brand.luchiiLogo} alt="" className="w-7 h-7 rounded-full object-contain shrink-0" />
                      <span className="min-w-0">
                        <span className="flex items-baseline gap-2 min-w-0"><span className="text-xs font-semibold whitespace-nowrap">{m.name}</span>
                        <span className="text-[11px] text-neutral-500 truncate">{m.desc}</span></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {mode === "image" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Reference image</label>
                {refImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10">
                    <img src={refImage} alt="reference" className="w-full h-40 object-cover" />
                    <button onClick={() => setRefImage(null)}
                      className="absolute top-2 right-2 grid place-items-center w-7 h-7 rounded-full bg-black/70 hover:bg-black">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full h-32 rounded-xl border border-dashed border-white/15 bg-black/30 grid place-items-center text-neutral-500 hover:border-[#00F0FF]/50 hover:text-neutral-300 transition-colors">
                    <div className="flex flex-col items-center gap-1.5">
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">Upload a photo to remix</span>
                    </div>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  {mode === "image" ? "How to transform it" : "Prompt"}
                </label>
                <button
                  onClick={() => setPrompt(promptSuggestions[Math.floor(Math.random() * promptSuggestions.length)])}
                  className="inline-flex items-center gap-1 text-xs text-[#00F0FF] hover:underline">
                  <Dice5 className="w-3.5 h-3.5" /> Surprise me
                </button>
              </div>
              <Textarea data-testid="prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === "image"
                  ? "make it a snowy winter night..."
                  : "A cinematic portrait of an astronaut in neon rain..."}
                className="min-h-28 resize-none bg-black/40 border-white/10 focus-visible:ring-[#00F0FF]" />
            </div>

            {mode === "image" && (
              <p data-testid="painterx-hint" className="text-[11px] text-neutral-500 -mt-3">
                Painter-X follows plain edit commands, like "make it snowy" or "turn day into night", and keeps your layout.
              </p>
            )}

            {isNova && (
              <label data-testid="draft-toggle" className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 cursor-pointer">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">Quick draft</span>
                  <span className="block text-[11px] text-neutral-500">Preview in under a minute, then render full quality</span>
                </span>
                <input type="checkbox" data-testid="draft-toggle-input" checked={draftMode} onChange={(e) => setDraftMode(e.target.checked)}
                  className="w-4 h-4 accent-[#00F0FF] shrink-0" />
              </label>
            )}

            {mode === "text" && (
              <>
                <PresetRow presets={IMAGE_PRESETS} testid="image-preset"
                  onPick={(p) => { setPrompt(p.prompt); if (p.style) setStyle(p.style); }} />
                <div>
                  <label className="text-sm font-medium mb-2 block">Style</label>
                  <div className="flex flex-wrap gap-2">
                    {genStyles.map((s) => (
                      <button key={s.id} onClick={() => setStyle(s.id)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
                          style === s.id ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                            : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Aspect ratio</label>
                  <div className="flex flex-wrap gap-2">
                    {genAspects.map((a) => (
                      <button key={a.id} onClick={() => setAspect(a.id)}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-medium border transition-colors ${
                          aspect === a.id ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                            : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button data-testid="generate-btn" onClick={handleGenerate} disabled={loading}
              className="w-full h-11 bg-[#00F0FF] text-black hover:bg-[#00d4de] font-semibold rounded-full">
              {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>)
                : (<><Wand2 className="w-4 h-4 mr-2" /> {mode === "image" ? "Remix image" : "Generate"}</>)}
            </Button>
            {!user && (
              <p className="text-xs text-neutral-500 text-center">
                Tip: log in to save every creation to your private gallery.
              </p>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="space-y-6 lg:order-1">
          <div className="rounded-2xl border border-white/10 bg-[#1E2327] aspect-video grid place-items-center overflow-hidden relative">
            {loading ? (
              <div data-testid={queued ? "image-queue-notice" : "image-loading"}>
                <LogoLoader
                  label={queued ? "Your image is in the queue..." : renderingFull ? "Rendering full quality..." : mode === "image" ? "Remixing your image..." : "Dreaming up your image..."}
                  sublabel={queued ? "Frasberg Creator is finishing another image. Yours starts next."
                    : renderingFull ? "Luchii Nova-Muse full photoreal render · about 2 minutes"
                    : mode === "image" ? "Luchii Painter-X is applying your edit · about 3 minutes"
                    : isNova ? (draftMode ? "Luchii Nova-Muse quick draft · under a minute" : "Luchii Nova-Muse photoreal render · about 2 minutes")
                    : "Powered by Frasberg"}
                />
              </div>
            ) : image ? (
              <>
                <img data-testid="result-image" src={image} alt="Generated" className="w-full h-full object-contain" />
                <LuchiiBadge overlay model={resultModel} testId="result-luchii-badge" />
                {lastDraft && (
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span data-testid="draft-badge" className="rounded-full bg-black/70 backdrop-blur px-3 py-1 text-[11px] font-semibold tracking-wide">DRAFT</span>
                    <button data-testid="render-full-btn" onClick={handleFullRender} disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#00F0FF] text-black px-3.5 py-1.5 text-xs font-semibold hover:bg-[#00d4de] disabled:opacity-60">
                      <Wand2 className="w-3.5 h-3.5" /> Render full quality
                    </button>
                  </div>
                )}
                {upscaling && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm grid place-items-center">
                    <div data-testid={queued ? "upscale-queue-notice" : "upscale-loading"}>
                      <LogoLoader label={queued ? "Your upscale is in the queue..." : "Enhancing to 4K..."}
                        sublabel={queued ? "Frasberg Creator is finishing another image. Yours starts next." : "AI detail re-render"} />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button data-testid="upscale-btn" onClick={handleUpscale} disabled={upscaling}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#00F0FF] text-black px-4 py-2 text-sm font-semibold hover:bg-[#00d4de] disabled:opacity-60">
                    <Maximize2 className="w-4 h-4" /> Upscale to 4K
                  </button>
                  <button onClick={handleShare}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-4 py-2 text-sm font-medium hover:bg-black">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button onClick={() => downloadWithLuchii(image, "frasberg-creator.png", resultModel)} data-testid="result-download-btn"
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-4 py-2 text-sm font-medium hover:bg-black">
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-neutral-600">
                <ImageIcon className="w-10 h-10" />
                <p className="text-sm">Your generated image will appear here</p>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3 text-neutral-400">Recent generations</h3>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {history.map((h, i) => (
                  <button key={i} onClick={() => { setImage(h.url); setResultId(h.id); setResultModel(h.model || "Luchii Nova-Muse"); setLastDraft(null); }}
                    className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-[#00F0FF]/50">
                    <img src={h.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
