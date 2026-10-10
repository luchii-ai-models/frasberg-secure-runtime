import { brand } from "../mock";

const load = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

export async function downloadWithLuchii(src, filename, model = "Luchii") {
  const a = document.createElement("a");
  a.download = filename;
  try {
    const [img, mark] = await Promise.all([load(src), load(brand.luchiiLogo)]);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const s = Math.round(Math.min(c.width, c.height) * 0.09);
    const pad = Math.round(s * 0.35);
    ctx.font = `600 ${Math.round(s * 0.36)}px sans-serif`;
    const textW = ctx.measureText(model).width;
    const w = s + pad * 1.5 + textW, h = s + pad * 0.6;
    const x = c.width - w - pad, y = c.height - h - pad;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, h / 2) : ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.drawImage(mark, x + pad * 0.3, y + pad * 0.3, s, s);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(model, x + s + pad * 0.8, y + h / 2);
    a.href = c.toDataURL("image/png");
  } catch (_) {
    a.href = src;
  }
  a.click();
}
