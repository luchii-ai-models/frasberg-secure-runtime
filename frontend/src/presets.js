// One-tap prompt presets per studio. Each preset fills a ready-to-go prompt
// (and a matching style where it applies) so users get great results without
// wording prompts themselves.

export const IMAGE_PRESETS = [
  { id: "portrait", label: "Portrait", style: "photorealistic", prompt: "A striking close-up portrait of a person, soft natural window light, 85mm lens, sharp catchlight in the eyes, shallow depth of field, skin texture detail" },
  { id: "landscape", label: "Landscape", style: "cinematic", prompt: "A breathtaking landscape at golden hour, dramatic sky, layered mountains and mist, rich warm colours, ultra detailed, wide vista" },
  { id: "product", label: "Product shot", style: "product", prompt: "A premium product on a seamless studio backdrop, softbox lighting, crisp reflections, commercial advertising photography, high detail" },
  { id: "character", label: "Anime character", style: "anime", prompt: "A vibrant anime character key visual, clean line art, luminous cel shading, expressive eyes, detailed background, studio quality" },
  { id: "logo", label: "Logo / icon", style: "digital-art", prompt: "A minimal modern logo icon, bold geometric shape, flat vector style, clean negative space, centered on a solid background" },
  { id: "scifi", label: "Sci-fi scene", style: "3d", prompt: "A futuristic sci-fi city at night, glowing neon signs, rain-slick streets, volumetric light, cinematic 3D render, highly detailed" },
];

export const VIDEO_PRESETS = [
  { id: "cinematic", label: "Cinematic", style: "cinematic", prompt: "A sweeping cinematic establishing shot of a dramatic landscape, slow camera push-in, golden hour light, shallow depth of field" },
  { id: "nature", label: "Nature doc", style: "photoreal", prompt: "A serene nature documentary scene, a lone animal in the wild, gentle camera pan across the landscape, soft morning light" },
  { id: "anime", label: "Anime scene", style: "anime", prompt: "An anime action scene with dynamic motion, wind-blown hair, vibrant colours and expressive characters, speed lines" },
  { id: "product", label: "Product ad", style: "3d", prompt: "A sleek product advertisement, hero product slowly rotating on a clean studio backdrop, soft reflections, premium lighting" },
  { id: "fantasy", label: "Fantasy", style: "fantasy", prompt: "An epic fantasy landscape with glowing magic, floating particles, a towering castle, cinematic atmosphere and drifting clouds" },
  { id: "vlog", label: "Travel vlog", style: "photoreal", prompt: "A sunny travel vlog montage, handheld camera through a vibrant street market, warm colours, lively energy" },
];

export const MUSIC_PRESETS = [
  { id: "reggae", label: "Reggae", prompt: "Classic roots reggae with offbeat guitar skank, deep dub bassline, steady one-drop drums, warm organ bubble, sunny laid-back island groove" },
  { id: "reggae-fusion", label: "Reggae Fusion", prompt: "Reggae fusion blending roots reggae with pop and R&B — smooth melodic hook, modern synths, offbeat guitar, crisp live drums, radio-ready" },
  { id: "dancehall", label: "Reggae Dancehall", prompt: "Dancehall riddim — punchy digital drums, heavy sub-bass, syncopated catchy rhythm, energetic club-ready island groove" },
  { id: "amapiano", label: "Amapiano", prompt: "Amapiano — deep log-drum bassline, airy pads, soulful piano chords, shaker percussion, smooth South African house groove" },
  { id: "jazz", label: "Jazz", style: "jazz", prompt: "Smooth late-night jazz — brushed drums, walking upright bass, warm piano comping, mellow saxophone lead, intimate club mood" },
];

export const MODEL3D_PRESETS = [
  { id: "treasure", label: "Game asset", prompt: "a stylized fantasy treasure chest" },
  { id: "robot", label: "Character", prompt: "a cute cartoon robot" },
  { id: "car", label: "Vehicle", prompt: "a sleek futuristic sports car" },
  { id: "chair", label: "Furniture", prompt: "a cozy modern armchair" },
  { id: "donut", label: "Food", prompt: "a glossy chocolate donut with sprinkles" },
  { id: "crystal", label: "Sci-fi prop", prompt: "a glowing sci-fi energy crystal" },
];
