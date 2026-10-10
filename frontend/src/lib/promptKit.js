// Built-in prompt kit for the /create composer: a large preset pool that rotates, and a
// "Surprise me" generator that builds a fresh prompt every time (never the same demo text).

export const TEXT_PRESETS = [
  { id: "portrait", label: "Portrait", style: "photorealistic", aspect: "3:4", prompt: "Close-up portrait of a young woman with freckles, soft window light, natural skin texture, 85mm lens, shallow depth of field" },
  { id: "landscape", label: "Landscape", style: "cinematic", aspect: "16:9", prompt: "Misty mountain valley at golden hour, layered ridges, warm sun rays through clouds, wide vista" },
  { id: "product", label: "Product shot", style: "product", aspect: "1:1", prompt: "Luxury perfume bottle on wet black marble, soft rim light, water droplets, premium advertising shot" },
  { id: "anime", label: "Anime hero", style: "anime", aspect: "3:4", prompt: "Anime girl with silver hair and a red scarf on a rooftop at sunset, wind in her hair, city skyline behind" },
  { id: "logo", label: "Logo / icon", style: "digital-art", aspect: "1:1", prompt: "Minimal fox head logo icon, bold geometric shapes, flat vector, orange on a clean white background" },
  { id: "scifi", label: "Sci-fi city", style: "3d", aspect: "16:9", prompt: "Futuristic city at night with flying cars, glowing neon signs, rain-slick streets, volumetric light" },
  { id: "food", label: "Food photo", style: "product", aspect: "4:3", prompt: "Stack of fluffy pancakes with berries and dripping maple syrup, morning light, rustic wooden table" },
  { id: "fashion", label: "Fashion", style: "cinematic", aspect: "3:4", prompt: "Fashion editorial of a model in a flowing red dress on a windy beach, overcast light, film look" },
  { id: "pet", label: "Cute pet", style: "photorealistic", aspect: "1:1", prompt: "Golden retriever puppy sitting in autumn leaves, soft afternoon light, detailed fur, happy expression" },
  { id: "fantasy", label: "Fantasy world", style: "digital-art", aspect: "16:9", prompt: "Floating islands with waterfalls above the clouds, giant glowing tree, dragons flying, epic scale" },
  { id: "car", label: "Supercar", style: "3d", aspect: "16:9", prompt: "Sleek matte black supercar in a dark studio, dramatic red rim lighting, reflective floor" },
  { id: "interior", label: "Interior", style: "photorealistic", aspect: "4:3", prompt: "Cozy Scandinavian living room, large window, plants, warm wood, soft daylight, interior design photo" },
  { id: "space", label: "Deep space", style: "cinematic", aspect: "16:9", prompt: "Glowing purple and blue nebula with a bright star cluster, deep space photograph, ultra detailed" },
  { id: "chrome", label: "3D abstract", style: "3d", aspect: "1:1", prompt: "Twisted liquid chrome sculpture with teal reflections on a glossy floor, studio lighting" },
  { id: "street", label: "Street photo", style: "cinematic", aspect: "3:4", prompt: "Rainy Tokyo street at night, person with a clear umbrella, neon reflections on wet pavement" },
  { id: "watercolor", label: "Watercolor", style: "digital-art", aspect: "4:3", prompt: "Watercolor painting of a seaside village with colorful houses, soft washes, loose brush strokes" },
  { id: "character", label: "Game character", style: "3d", aspect: "3:4", prompt: "Stylized armored knight character, full body, glowing blue sword, game concept, clean background" },
  { id: "wedding", label: "Couple", style: "photorealistic", aspect: "3:4", prompt: "Happy couple laughing in a sunflower field at sunset, warm golden light, candid photo" },
];

export const REMIX_PRESETS = [
  { id: "snow", label: "Snowy night", prompt: "make it a snowy winter night" },
  { id: "anime", label: "Anime style", style: "anime", prompt: "turn it into an anime illustration" },
  { id: "sunset", label: "Golden sunset", prompt: "make it golden hour sunset light" },
  { id: "oil", label: "Oil painting", prompt: "turn it into an oil painting" },
  { id: "cyber", label: "Cyberpunk neon", prompt: "make it cyberpunk with neon lights" },
  { id: "spring", label: "Spring flowers", prompt: "add blooming spring flowers" },
  { id: "rain", label: "Rainy mood", prompt: "make it rainy and moody" },
  { id: "sketch", label: "Pencil sketch", prompt: "turn it into a pencil sketch" },
  { id: "3d", label: "3D cartoon", style: "3d", prompt: "turn it into a 3D cartoon character" },
  { id: "autumn", label: "Autumn", prompt: "make it autumn with orange leaves" },
  { id: "vintage", label: "Vintage film", prompt: "make it look like a vintage 1970s photo" },
  { id: "night", label: "Day to night", prompt: "turn day into night with city lights" },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

const SUBJECTS = [
  "an old fisherman mending nets", "a ballerina mid-leap", "a red fox in fresh snow", "a lighthouse on a stormy cliff",
  "a vintage motorcycle", "a cup of steaming coffee", "an astronaut floating above Earth", "a koi pond with lotus flowers",
  "a street food vendor at night", "a samurai in a bamboo forest", "a hot air balloon festival", "a snow leopard on a rock",
  "a cozy cabin in a pine forest", "a jazz saxophonist on stage", "a hummingbird near a flower", "a desert caravan of camels",
  "a glass terrarium with tiny plants", "a futuristic sports sneaker", "a grandmother baking bread", "a wolf howling at the moon",
  "a surfer riding a giant wave", "a robot gardener watering plants", "a Venetian canal at dawn", "a bowl of ramen",
  "a child flying a kite", "a medieval castle on a hill", "a chameleon on a branch", "a neon-lit arcade",
];
const SCENES = [
  "at golden hour", "in heavy rain", "under northern lights", "in morning fog", "at blue hour", "in a snowstorm",
  "under cherry blossoms", "on a misty lake", "in a sunlit studio", "at sunset by the sea", "in a neon city at night",
  "in an autumn forest", "under a starry sky", "on a rooftop at dusk",
];
const LOOKS = {
  photorealistic: ["natural skin and texture detail", "shot on a 50mm lens", "soft natural light", "crisp, true-to-life colors"],
  cinematic: ["anamorphic film look", "moody teal and orange grade", "dramatic side light", "wide cinematic framing"],
  "3d": ["glossy octane render", "soft clay render look", "stylized Pixar-like render", "isometric diorama"],
  anime: ["Studio Ghibli inspired", "vibrant cel shading", "dynamic anime key visual", "soft pastel anime colors"],
  "digital-art": ["vivid fantasy illustration", "watercolor texture", "bold graphic poster style", "dreamy matte painting"],
  product: ["premium studio advertising shot", "clean seamless backdrop", "dramatic product lighting", "minimal luxury styling"],
};
const REMIX_IDEAS = [
  "make it look like a watercolor painting", "turn it into a comic book panel", "make it a foggy autumn morning",
  "add fireworks in the sky", "make it underwater", "turn it into a stained glass window", "make it a desert at noon",
  "add falling cherry blossoms", "turn it into a Van Gogh painting", "make everything made of gold",
  "make it a frozen ice world", "turn it into pixel art", "add a rainbow", "make it a candle-lit evening",
  "turn it into a pop art poster", "make it look like a claymation scene", "add glowing fireflies", "make it look like a neon sign",
];

const recent = [];
const fresh = (gen) => {
  for (let i = 0; i < 20; i++) {
    const p = gen();
    if (!recent.includes(p)) {
      recent.push(p);
      if (recent.length > 30) recent.shift();
      return p;
    }
  }
  return gen();
};

// A new, never-recently-seen prompt each click, shaped by the current style and mode.
export function surprisePrompt(mode = "text", style = "cinematic") {
  if (mode === "image") return fresh(() => pick(REMIX_IDEAS));
  const looks = LOOKS[style] || LOOKS.cinematic;
  return fresh(() => {
    const s = pick(SUBJECTS);
    return `${s.charAt(0).toUpperCase()}${s.slice(1)} ${pick(SCENES)}, ${pick(looks)}`;
  });
}

// Random subset of presets, excluding the ones just shown so the row keeps changing.
export function rotatePresets(pool, count, exclude = []) {
  const left = pool.filter((p) => !exclude.includes(p.id));
  const src = left.length >= count ? left : pool;
  return [...src].sort(() => Math.random() - 0.5).slice(0, count);
}
