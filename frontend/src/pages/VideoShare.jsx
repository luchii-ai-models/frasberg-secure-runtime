import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useParams } from "react-router-dom";
import { Clapperboard, Download, Share2, Sparkles, Loader2, RotateCcw } from "lucide-react";
import Navbar from "../components/Navbar";
import { LuchiiBadge } from "../components/LuchiiBadge";
import Footer from "../components/Footer";
import { shareVideo, isPreviewEngine } from "./Studio";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function VideoShare() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    axios.get(`${BACKEND}/api/videos/${id}`).then(({ data }) => setVideo(data))
      .catch(() => setError("This video doesn't exist or was removed."));
  }, [id]);

  const src = video ? `${BACKEND}${video.url}` : null;
  const vertical = video?.aspect_ratio === "9:16";
  const replay = () => { if (ref.current) { ref.current.currentTime = 0; ref.current.play(); } };

  return (
    <div className="min-h-screen bg-[#05060A] text-white">
      <Navbar />
      <main className="max-w-[1100px] mx-auto px-5 md:px-8 pt-28 pb-24" data-testid="video-share-page">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 mb-5">
          <Clapperboard className="w-3.5 h-3.5 text-[#00F0FF]" /> Made with {video?.engine || "Frasberg Motion"} · Powered by Frasberg
        </div>
        <h1 className="font-display font-bold tracking-tight text-3xl sm:text-4xl lg:text-5xl line-clamp-3" data-testid="video-share-title">
          {error ? "Video not found" : video ? video.prompt : "Loading…"}
        </h1>
        {video && (
          <p className="mt-3 text-neutral-400 text-sm" data-testid="video-share-meta">
            {video.mode === "image-to-video" ? "Photo-to-video" : "Text-to-video"} · {video.duration}s · {video.aspect_ratio}
            {video.author ? ` · by ${video.author}` : ""}
            {isPreviewEngine(video.engine) ? " · Preview (animated stills)" : ""}
          </p>
        )}

        <div className={`relative mt-8 rounded-2xl border border-white/10 bg-[#11161A] grid place-items-center overflow-hidden ${vertical ? "max-w-sm mx-auto aspect-[9/16]" : video?.aspect_ratio === "1:1" ? "max-w-xl mx-auto aspect-square" : "aspect-video"}`}>
          {error ? <p className="text-neutral-500" data-testid="video-share-error">{error}</p>
            : !video ? <Loader2 className="w-8 h-8 animate-spin text-[#00F0FF]" />
            : <video ref={ref} data-testid="video-share-player" src={src} controls autoPlay loop muted playsInline className="w-full h-full object-contain" />}
          {video && !error && <LuchiiBadge overlay model="Luchii Video" className="!top-3 !right-3 !bottom-auto" testId="video-share-luchii-badge" />}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          {video && (
            <>
              <button data-testid="video-share-replay-btn" onClick={replay}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm hover:bg-white/10">
                <RotateCcw className="w-4 h-4" /> Replay
              </button>
              <button data-testid="video-share-copy-btn" onClick={() => shareVideo(video.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm hover:bg-white/10">
                <Share2 className="w-4 h-4" /> Share
              </button>
              <a data-testid="video-share-download-btn" href={`${src}/download`} download={`luchii-video-${video.id.slice(0, 8)}.mp4`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm hover:bg-white/10">
                <Download className="w-4 h-4" /> Download .mp4
              </a>
            </>
          )}
          <Link to="/video" data-testid="video-share-cta"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#00F0FF] text-black px-5 py-2.5 text-sm font-semibold hover:bg-[#00d4de]">
            <Sparkles className="w-4 h-4" /> Make your own video
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
