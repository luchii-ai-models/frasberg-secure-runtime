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

// TikTok-style one-tap text-to-video presets. "Surprise me" picks a random idea from SURPRISE_VIDEO_IDEAS.
export const TIKTOK_VIDEO_PRESETS = [
  { id: "surprise", label: "Surprise me", surprise: true },
  { id: "pov", label: "POV", style: "photoreal", prompt: "POV handheld vertical shot walking into a neon-lit night market, steam rising from food stalls, people smiling at the camera, lively crowd, shallow depth of field" },
  { id: "glowup", label: "Glow-up transition", style: "cinematic", prompt: "A quick glow-up transition: a person in a plain hoodie spins and is instantly transformed into a sparkling evening outfit, confetti burst, studio lights flare, smooth whip-pan" },
  { id: "satisfying", label: "Satisfying loop", style: "3d", prompt: "An oddly satisfying seamless loop of glossy liquid chrome spheres rolling down a pastel marble run, soft studio lighting, perfect slow motion" },
  { id: "pet", label: "Pet reaction", style: "photoreal", prompt: "A fluffy golden retriever puppy tilts its head in surprise, ears perking up, then excitedly jumps toward the camera, cozy living room, warm afternoon light" },
  { id: "dance", label: "Street dance", style: "cinematic", prompt: "A street dancer pops and locks to the beat on a rain-slick city rooftop at dusk, dynamic low-angle camera orbit, neon reflections, energetic motion" },
  { id: "food", label: "Food ASMR", style: "photoreal", prompt: "Extreme close-up of molten chocolate pouring over a stack of fluffy pancakes, butter melting, powdered sugar falling in slow motion, macro food commercial" },
  { id: "outfit", label: "Outfit check", style: "photoreal", prompt: "Full-body outfit check: a stylish person confidently walks toward the camera on a sunny city sidewalk, jacket flowing, camera tracking backwards, fashion-film look" },
];

export const SURPRISE_VIDEO_IDEAS = [
  { style: "fantasy", prompt: "A tiny dragon hatches from a glowing egg on a wizard's desk, stretches its wings and sneezes a puff of sparkles" },
  { style: "anime", prompt: "An anime girl on a bicycle races a speeding train along a seaside track at sunset, hair and scarf whipping in the wind" },
  { style: "cinematic", prompt: "An astronaut slowly removes her helmet on an alien beach as two moons rise over violet waves" },
  { style: "3d", prompt: "A cute robot barista makes latte art of a heart, then proudly slides the cup toward the camera" },
  { style: "photoreal", prompt: "A cat in tiny sunglasses rides a skateboard down a sunny boardwalk, palm trees passing by" },
  { style: "noir", prompt: "A detective in a trench coat lights a match in a rainy alley, smoke curling through a single shaft of light" },
  { style: "fantasy", prompt: "A whale made of stars swims through the clouds above a sleeping city at night" },
  { style: "cinematic", prompt: "A vintage red convertible drifts around a desert canyon bend, dust exploding behind it, golden hour" },
  { style: "3d", prompt: "Colourful jelly cubes bounce and wobble in a satisfying chain reaction on a pastel table" },
  { style: "anime", prompt: "A samurai draws his sword as cherry blossom petals swirl around him in a sudden gust of wind" },
];

// Photo-to-video motion presets (shown when a start image is attached). The prompt describes the motion to apply.
export const PHOTO_MOTION_PRESETS = [
  { id: "zoom-in", label: "Zoom in", prompt: "Slow cinematic push-in zoom toward the subject's face, subtle parallax in the background, natural breathing motion, shallow depth of field" },
  { id: "orbit", label: "Orbit 360", prompt: "Smooth camera orbit around the subject in a half circle, revealing depth and dimension, the subject stays still and centered, steady gimbal motion" },
  { id: "hair-wind", label: "Hair in wind", prompt: "A gentle breeze blows through the subject's hair and clothes, strands flowing naturally, soft light flicker, the subject blinks and holds a calm expression" },
  { id: "come-alive", label: "Come alive", prompt: "The person in the photo comes alive: they blink, take a breath, smile softly and look directly into the camera, subtle head movement" },
  { id: "dolly-out", label: "Dolly out", prompt: "Dramatic dolly-out pulling the camera back to reveal the wider scene around the subject, smooth and steady" },
  { id: "parallax", label: "3D parallax", prompt: "Depth parallax effect: foreground and background separate as the camera glides sideways, giving the photo a 3D living-picture feel" },
  { id: "slowmo", label: "Slow-mo", prompt: "Dreamy slow motion: everything in the scene moves gently, floating particles drift through the light, ethereal atmosphere" },
  { id: "rain-glow", label: "Rain & neon", prompt: "Rain begins to fall around the subject, neon reflections shimmer on wet surfaces, droplets catch the light, moody cinematic atmosphere" },
];
