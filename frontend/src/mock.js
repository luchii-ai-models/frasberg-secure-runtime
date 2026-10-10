// Mock data for Frasberg Creator — replaced by backend where noted in contracts.md

export const brand = {
  name: "Frasberg Creator",
  logo: "/frasberg-emblem.png",
  luchiiLogo: "/luchii-logo.png",
};

export const navLinks = [
  { label: "Create", href: "/create" },
  { label: "Tools", href: "#tools" },
  { label: "Agent", href: "/agent" },
  { label: "Models", href: "/models" },
  { label: "API", href: "/developers" },
  { label: "Luchii Code", href: "/about-luchii", luchii: true },
];

export const heroPills = [
  "Build workflows",
  "Video upscaling",
  "Direct photoshoots",
  "Cast characters",
  "Stay on brand",
  "Upscale to 4K",
  "Draft storyboards",
  "Scale campaigns",
  "Generate images",
  "Shoot cinematic videos",
];

export const companies = [
  "NOVA", "OGILVE", "R/GA", "WONDER", "GUESS", "HELIOS", "VERTEX", "LUMEN",
];

export const heroImage =
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwxfHxBSSUyMGFydHxlbnwwfHx8fDE3ODYyNzY4NTJ8MA&ixlib=rb-4.1.0&q=85";

export const suiteTabs = [
  { id: "suite", label: "Creative Suite" },
  { id: "api", label: "MCP & API", badge: "New" },
  { id: "agents", label: "Agents", badge: "New" },
  { id: "plugins", label: "Plugins", badge: "New" },
  { id: "stock", label: "Stock" },
];

export const capabilities = [
  {
    id: "image",
    title: "Image",
    desc: "Generate, edit, resize, upscale. Keep characters and brand consistent across every shot.",
    img: "https://images.unsplash.com/photo-1636690581110-a512fed05fd3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHw0fHxBSSUyMGFydHxlbnwwfHx8fDE3ODYyNzY4NTJ8MA&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "video",
    title: "Video",
    desc: "Generate shots and full scenes. Edit with precise control. Built for cinematic work and campaigns.",
    img: "https://images.unsplash.com/photo-1769613547913-7172c7cd772c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHw0fHxmdXR1cmlzdGljJTIwY3JlYXRpdmV8ZW58MHx8fHwxNzg2Mjc2ODUyfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "audio",
    title: "Audio",
    desc: "Create your own voices, music, and sound effects. From dialogue to score, in your voice.",
    img: "https://images.unsplash.com/photo-1631727498498-5dd093268aea?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwzfHxmdXR1cmlzdGljJTIwY3JlYXRpdmV8ZW58MHx8fHwxNzg2Mjc2ODUyfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "3d",
    title: "3D",
    desc: "Direct photoshoots with full control. Build 3D scenes from any image.",
    img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxjaW5lbWF0aWMlMjBwb3J0cmFpdHxlbnwwfHx8fDE3ODYyNzY4NTF8MA&ixlib=rb-4.1.0&q=85",
  },
];

export const aiModels = [
  "Luchii GPT 2", "Nano Banana 2", "Grok Imagine", "Happyhorse 1", "Krea 2",
  "Veo 3", "Seedream 5", "Seedance 2", "Kling 3", "Flux 2", "ElevenLabs",
  "Runway Gen 4.5", "Wan", "Minimax",
];

export const tools = [
  { title: "AI Image Generator", desc: "Create top-quality images with the best AI models", featured: true, route: "/create" },
  { title: "Video Creator", desc: "Create videos from text, image, or both", route: "/video" },
  { title: "Image Upscaler", desc: "Upscale any photo to true 4K with real AI detail", route: "/create?tool=upscale" },
  { title: "Image Editor", desc: "Remix any photo with a plain-language edit", route: "/create?tool=edit" },
  { title: "Background Remover", desc: "Remove any background in one click", route: "/create?tool=remove-bg" },
  { title: "Text to Speech", desc: "Turn your text into natural speech, in any voice", route: "/tts" },
  { title: "Speech to Speech", desc: "Convert one voice into another, instantly", route: "/sts" },
  { title: "Voice Cloning", desc: "Clone your voice and speak any text with it", route: "/voice-clone" },
  { title: "Audio Studio", desc: "Generate music, sound effects, and audio beds", route: "/audio" },
  { title: "3D Studio", desc: "Generate 3D objects and assets from a prompt", route: "/3d" },
  { title: "Spaces Builder", desc: "Build interactive 3D worlds and scenes", route: "/spaces" },
  { title: "Change the Scene", desc: "Turn day into night, add snow, change the season", route: "/create?tool=edit&prompt=turn%20day%20into%20night" },
  { title: "All models", desc: "Explore every Luchii and Frasberg model", route: "/models" },
];

export const useCases = [
  { title: "Advertising", desc: "Brief to final asset. No vendor chain, no waiting. Just the work.", img: "https://images.unsplash.com/photo-1568038479111-87bf80659645?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwzfHxjaW5lbWF0aWMlMjBwb3J0cmFpdHxlbnwwfHx8fDE3ODYyNzY4NTF8MA&ixlib=rb-4.1.0&q=85" },
  { title: "Product shots", desc: "AI-powered photoshoots. No studio. No crew. No scheduling.", img: "https://images.pexels.com/photos/29433729/pexels-photo-29433729.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  { title: "Brand campaigns", desc: "On-brand visuals, video, and audio at any scale, any format.", img: "https://images.pexels.com/photos/15649980/pexels-photo-15649980.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  { title: "Filmmaking", desc: "Characters, storyboards, and concepts to explore. Cinematic tools for the final frame.", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxjaW5lbWF0aWMlMjBwb3J0cmFpdHxlbnwwfHx8fDE3ODYyNzY4NTF8MA&ixlib=rb-4.1.0&q=85" },
];

export const testimonials = [
  { quote: "Best-in-class models and workflow tools through a single unified interface. Frasberg Creator has been a key unlock as we've woven AI into our workflows, end to end.", name: "Nick Coronges", role: "CTO at R/GA" },
  { quote: "We are highly satisfied with Frasberg Creator. It consistently delivers high-quality, reliable results while streamlining workflows and enhancing efficiency.", name: "Javier Romero", role: "Global Head of Content" },
  { quote: "Frasberg Creator is a key part of our marketing stack. It helps us create high-quality content at scale as we expand our AI-native platform.", name: "Juan Urdiales", role: "Co-Founder & Co-CEO" },
];

export const pricing = [
  { name: "Starter", price: "$0", period: "/mo", desc: "For exploring what's possible.", features: ["30 credits / month", "Image generation", "Standard queue", "Community support"], cta: "Start free", highlight: false },
  { name: "Pro", price: "$39", period: "/mo", desc: "For creators shipping real work.", features: ["3,000 credits / month", "All AI models", "Priority queue", "4K upscaling", "Commercial license"], cta: "Go Pro", highlight: true },
  { name: "Business", price: "$129", period: "/mo", desc: "For teams creating at scale.", features: ["12,000 shared credits", "Unlimited users", "Collaborative Spaces", "Priority support", "Admin controls"], cta: "Start team trial", highlight: false },
];

export const faqs = [
  { q: "What is Frasberg Creator?", a: "Frasberg Creator is a full creative platform for images — generate, remix (image-to-image), and upscale, all powered by Frasberg." },
  { q: "What powers Frasberg Creator?", a: "Every Frasberg Creator tool and model is powered by Frasberg — image, video, voice, music and 3D, all in one place." },
  { q: "Who owns the content I create?", a: "You do. Everything you generate belongs to you, and it comes with a full commercial AI license." },
  { q: "Can I use Frasberg Creator for commercial work?", a: "Yes. The content you generate includes a full commercial license so you can use it in real projects." },
];

export const footerCols = [
  { title: "Product", links: ["Audio", "3D", "Spaces", "Image", "Video", "API"] },
  { title: "Tools", links: ["Image Generator", "Upscaler", "Background Remover", "Photo Editor", "Text to Speech"] },
  { title: "Company", links: ["Luchii Code", "About", "Careers", "Blog", "Originals", "Contact"] },
  { title: "Resources", links: ["Help center", "Enterprise", "Community", "Status"] },
];

export const showcase = [
  { title: "Chrome Dream", style: "3D Render", styleId: "3d", img: "/showcase/chrome-dream.jpg", prompt: "A twisted teal glass and chrome ribbon sculpture shaped like a sphere, glowing cyan reflections on a glossy teal floor, studio lighting, octane render, ultra detailed" },
  { title: "Stardust", style: "Cosmic", styleId: "cinematic", img: "/showcase/stardust.jpg", prompt: "Deep-space photograph of a bright star cluster above towering orange nebula pillars, glowing cosmic dust, Hubble style, ultra detailed" },
  { title: "Neon Muse", style: "Fashion", styleId: "cinematic", img: "/showcase/neon-muse.jpg", prompt: "Neon fashion editorial portrait of a platinum-haired model in dark sunglasses and a black jacket, hot magenta rim light, blue neon city lights behind, cinematic" },
  { title: "Golden Hour", style: "Photoreal", styleId: "photorealistic", img: "/showcase/golden-hour.jpg", prompt: "Moody close-up portrait of a woman with long platinum blonde hair, soft warm side light on her face, dark background, natural skin texture, 85mm lens" },
  { title: "Hyperform", style: "3D Render", styleId: "3d", img: "/showcase/hyperform.jpg", prompt: "Futuristic hyperspace tunnel of glowing orange and cyan neon light panels rushing toward a bright cyan core, motion blur, 3D render" },
  { title: "Nebula Drift", style: "Cosmic", styleId: "digital-art", img: "/showcase/nebula-drift.jpg", prompt: "A swirling purple and blue ring nebula with a glowing pink core, scattered bright stars, deep space, vivid colors, ultra detailed" },
  { title: "Lost Valley", style: "Surreal", styleId: "digital-art", img: "/showcase/lost-valley.jpg", prompt: "Surreal red desert valley with lonely jagged peaks under a glowing pink aurora sky, dreamy haze, minimal fantasy landscape" },
  { title: "Deep Current", style: "Abstract", styleId: "3d", img: "/showcase/deep-current.jpg", prompt: "Smooth flowing abstract 3D waves in deep blue and violet, soft glowing gradients, glossy surfaces, octane render" },
];

export const modelFamilies = [
  {
    id: "frasberg",
    label: "Frasberg Models",
    blurb: "The flagship Frasberg family — built for cinematic realism and production-grade output.",
    models: [
      { name: "Frasberg Ex-Prime", tag: "Flagship", desc: "Our top text-to-image model with sharp detail and precise prompt control.", caps: ["Text to Image"], mode: "text", badge: "Default", img: "https://images.unsplash.com/photo-1780442491245-90152c92d84a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHw0fHxzdXJyZWFsJTIwZGlnaXRhbHxlbnwwfHx8fDE3ODY0NTA5OTZ8MA&ixlib=rb-4.1.0&q=85" },
      { name: "Frasberg Titan Core", tag: "Detail", desc: "Ultra-detailed generation with rich texture and lifelike fidelity.", caps: ["Text to Image"], mode: "text", img: "https://images.unsplash.com/photo-1776053473082-9520f829fbbb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHwxfHxzdXJyZWFsJTIwZGlnaXRhbHxlbnwwfHx8fDE3ODY0NTA5OTZ8MA&ixlib=rb-4.1.0&q=85" },
      { name: "Frasberg Apex-Sphere", tag: "Photoreal", desc: "Hyper-real portraits and product shots with natural lighting.", caps: ["Text to Image"], mode: "text", img: "https://images.pexels.com/photos/15649980/pexels-photo-15649980.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
      { name: "Frasberg Celestial Reactor", tag: "Film", desc: "Film-grade scenes with dramatic composition and color grade.", caps: ["Text to Image"], mode: "text", img: "https://images.unsplash.com/photo-1672872476232-da16b45c9001?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwyfHxjeWJlcnB1bmslMjBuZW9ufGVufDB8fHx8MTc4NjQ1MTAwMnww&ixlib=rb-4.1.0&q=85" },
      { name: "Frasberg Nebula-X", tag: "Fast", desc: "Rapid drafts and quick edits for fast iteration.", caps: ["Image to Image"], mode: "image", img: "https://images.unsplash.com/photo-1637947582297-24ccbef1bd19?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwxfHxzY2ktZmklMjBjb25jZXB0fGVufDB8fHx8MTc4NjQ1MTAwMnww&ixlib=rb-4.1.0&q=85" },
      { name: "Frasberg Motion Free", tag: "Free", desc: "Real AI motion on free GPUs. Text-to-video and photo-to-video at zero cost.", caps: ["Video", "Image to Video"], route: "/video?engine=frasberg-motion-free", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxjaW5lbWF0aWMlMjBwb3J0cmFpdHxlbnwwfHx8fDE3ODYyNzY4NTF8MA&ixlib=rb-4.1.0&q=85" },
      { name: "Frasberg Motion Fast", tag: "Video", desc: "Fast text-to-video and image-to-video for drafts and social clips.", caps: ["Video", "Image to Video"], route: "/video?engine=frasberg-motion-fast", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxjaW5lbWF0aWMlMjBwb3J0cmFpdHxlbnwwfHx8fDE3ODYyNzY4NTF8MA&ixlib=rb-4.1.0&q=85" },
      { name: "Frasberg Motion Pro", tag: "Video HQ", desc: "Cinematic 720p motion with strong prompt following. Animate any photo.", caps: ["Video", "Image to Video"], route: "/video?engine=frasberg-motion-pro", img: "https://images.unsplash.com/photo-1568038479111-87bf80659645?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwzfHxjaW5lbWF0aWMlMjBwb3J0cmFpdHxlbnwwfHx8fDE3ODY0ODE2NDV8MA&ixlib=rb-4.1.0&q=85" },
      { name: "Frasberg Motion Ultra", tag: "Flagship Video", desc: "Flagship-fidelity video for hero shots and ads.", caps: ["Video", "Image to Video"], route: "/video?engine=frasberg-motion-ultra", img: "https://images.unsplash.com/photo-1634834300387-8015d9fb7550?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwyfHxmdXR1cmlzdGljJTIwM0R8ZW58MHx8fHwxNzg2NDgxNjQ2fDA&ixlib=rb-4.1.0&q=85" },
    ],
  },
  {
    id: "luchii",
    label: "Luchii Models",
    logo: "/luchii-logo.png",
    blurb: "The Luchii studio family by Frasberg, Inc. — expressive creativity with effortless control.",
    models: [
      { name: "Luchii Nova-Muse", tag: "Creative", desc: "Top-quality, versatile generation across any subject or style.", caps: ["Text to Image"], mode: "text", img: "https://images.unsplash.com/photo-1636690581110-a512fed05fd3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHw0fHxBSSUyMGFydHxlbnwwfHx8fDE3ODY0NTA5OTZ8MA&ixlib=rb-4.1.0&q=85" },
      { name: "Luchii Painter-X", tag: "Editing", desc: "Remix any reference photo — restyle, reframe, and transform.", caps: ["Image to Image"], mode: "image", img: "https://images.pexels.com/photos/8108327/pexels-photo-8108327.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
      { name: "Luchii Prime", tag: "Enhance", desc: "AI enhancement re-render for crisp, high-resolution 4K detail.", caps: ["Upscale"], mode: "image", img: "https://images.unsplash.com/photo-1620121692029-d088224ddc74?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwyfHwzRCUyMGFic3RyYWN0fGVufDB8fHx8MTc4NjQ1MTAwMnww&ixlib=rb-4.1.0&q=85" },
      { name: "Luchii Dreamline", tag: "Artistic", desc: "Expressive, painterly styles and bold, vivid color.", caps: ["Text to Image"], mode: "text", img: "https://images.unsplash.com/photo-1568038479111-87bf80659645?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwzfHxjaW5lbWF0aWMlMjBwb3J0cmFpdHxlbnwwfHx8fDE3ODYyNzY4NTF8MA&ixlib=rb-4.1.0&q=85" },
      { name: "Luchii Vision", tag: "Concept", desc: "Concept art and stylized worlds with striking composition.", caps: ["Text to Image"], mode: "text", img: "https://images.pexels.com/photos/29433729/pexels-photo-29433729.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
      { name: "Luchii Cinematica", tag: "Video", desc: "Text-to-video with cinematic camera moves, lighting and motion.", caps: ["Video"], route: "/video", img: "https://images.unsplash.com/photo-1508364654111-570ff4726d27?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=940" },
      { name: "Luchii Animus", tag: "Photo Motion", desc: "Bring any photo to life: hair in wind, orbits, zooms and more.", caps: ["Image to Video"], route: "/video", img: "https://images.unsplash.com/photo-1633382148761-d56d55cee3cd?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=940" },
      { name: "Luchii Harmonia", tag: "Music", desc: "Original songs and beats in any genre, from a single prompt.", caps: ["Audio"], route: "/audio", img: "https://images.unsplash.com/photo-1574882225022-9e0e447e9662?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=940" },
      { name: "Luchii Sculpt 3D", tag: "3D", desc: "Prompt-to-3D meshes you can spin, inspect and download as .glb.", caps: ["3D"], route: "/3d", img: "https://images.unsplash.com/photo-1634834300387-8015d9fb7550?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwyfHxmdXR1cmlzdGljJTIwM0R8ZW58MHx8fHwxNzg2NDgxNjQ2fDA&ixlib=rb-4.1.0&q=85" },
      { name: "Luchii Vocalist Prime", tag: "Audio", desc: "Natural text-to-speech in a range of expressive voices.", caps: ["Audio"], route: "/tts", img: "https://images.unsplash.com/photo-1631727498498-5dd093268aea?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwzfHxmdXR1cmlzdGljJTIwY3JlYXRpdmV8ZW58MHx8fHwxNzg2Mjc2ODUyfDA&ixlib=rb-4.1.0&q=85" },
    ],
  },
];

// Gallery styles for the AI Image Generator tool page
export const genStyles = [
  { id: "cinematic", label: "Cinematic" },
  { id: "photorealistic", label: "Photorealistic" },
  { id: "3d", label: "3D Render" },
  { id: "anime", label: "Anime" },
  { id: "digital-art", label: "Digital Art" },
  { id: "product", label: "Product Shot" },
];

export const genAspects = [
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "4:3", label: "4:3" },
];

export const promptSuggestions = [
  "A cinematic portrait of an astronaut in neon rain, shallow depth of field",
  "Luxury perfume bottle on wet marble, studio lighting, product photography",
  "A surreal floating island city at golden hour, ultra detailed",
  "Cyberpunk street market, volumetric fog, 35mm film look",
];
