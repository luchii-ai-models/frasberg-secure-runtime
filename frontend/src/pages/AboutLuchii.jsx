import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Brain, Cpu, Layers, ShieldCheck, Sparkles, Zap } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { brand } from "../mock";

const PILLARS = [
  { icon: Brain, title: "Autonomous intelligence", text: "Luchii plans, reasons and refines on its own, turning a single idea into finished images, video, music, voice and 3D." },
  { icon: Zap, title: "Optimized everywhere", text: "Every Luchii engine is tuned for speed and accuracy, from fast drafts to flagship-quality renders." },
  { icon: Layers, title: "Every modality, one mind", text: "Image, video, audio, speech, sound effects, VoiceFX, 3D and Spaces share one intelligence, so your style carries across all of them." },
  { icon: Cpu, title: "Frontier-class", text: "Built by Frasberg to stand among the most advanced AI systems on the planet, including Claude, Grok, Dock.ai and fal.ai, and to keep pushing beyond them." },
  { icon: ShieldCheck, title: "Owned by Frasberg", text: "Frasberg.com and Frasberg, Inc. own and operate Luchii AI Models and all Luchii products and systems." },
];

const FAMILY = ["Luchii Nova-Muse", "Luchii Painter-X", "Luchii Prime", "Luchii Dreamline", "Luchii Vision", "Luchii Sculpt 3D", "Luchii Vocalist Prime"];

export default function AboutLuchii() {
  return (
    <div className="min-h-screen bg-transparent" data-testid="about-luchii-page">
      <Navbar />
      <section className="max-w-[1100px] mx-auto px-5 md:px-8 pt-32 md:pt-40 pb-12">
        <img src={brand.luchiiLogo} alt="Luchii logo" data-testid="about-luchii-logo" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-contain" />
        <p className="mt-8 text-xs uppercase tracking-[0.25em] text-[#00F0FF]">Frasberg AI Models &amp; Intelligence</p>
        <h1 className="font-display font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl mt-4 max-w-3xl">
          About <span className="text-[#00F0FF]">Luchii</span>
        </h1>
        <p className="mt-6 text-neutral-300 text-base md:text-lg max-w-2xl leading-relaxed">
          Luchii is Frasberg's family of AI models and its self-autonomous intelligence. It is the mind behind every
          creation. Frasberg Creator is the studio where you do the actual work: you direct, and Luchii creates.
        </p>
      </section>

      <section className="max-w-[1100px] mx-auto px-5 md:px-8 pb-16 grid md:grid-cols-2 gap-5">
        {PILLARS.map(({ icon: Icon, title, text }, i) => (
          <div key={title} data-testid={`about-luchii-pillar-${i}`} className="rounded-2xl border border-white/10 bg-[#1E2327]/80 p-6 hover:border-[#00F0FF]/40 transition-colors">
            <Icon className="w-6 h-6 text-[#00F0FF]" />
            <h2 className="font-display font-semibold text-base md:text-lg mt-4">{title}</h2>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </section>

      <section className="max-w-[1100px] mx-auto px-5 md:px-8 pb-16">
        <h2 className="font-display font-bold text-base md:text-lg flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#00F0FF]" /> The Luchii model family</h2>
        <div className="mt-5 flex flex-wrap gap-2.5" data-testid="about-luchii-family">
          {FAMILY.map((m) => (
            <span key={m} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1 pr-3.5 py-1 text-sm text-neutral-200">
              <img src={brand.luchiiLogo} alt="" className="w-6 h-6 rounded-full object-contain" /> {m}
            </span>
          ))}
        </div>
        <p className="mt-6 text-sm text-neutral-500 max-w-2xl">
          Look for the Luchii badge on your images, videos and songs. It marks work created by a Luchii model.
        </p>
      </section>

      <section className="max-w-[1100px] mx-auto px-5 md:px-8 pb-24 flex flex-wrap gap-3">
        <Link to="/create" data-testid="about-luchii-create-btn" className="inline-flex items-center gap-1 rounded-full bg-[#00F0FF] text-black font-semibold px-6 py-3 hover:bg-[#00d4de] transition-colors">
          Create with Luchii <ArrowUpRight className="w-4 h-4" />
        </Link>
        <Link to="/models" data-testid="about-luchii-models-btn" className="inline-flex items-center gap-1 rounded-full border border-white/15 text-white px-6 py-3 hover:bg-white/10 transition-colors">
          Explore models
        </Link>
      </section>
      <Footer />
    </div>
  );
}
