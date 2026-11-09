/**
 * Prepares brand and product images for the web.
 *
 *   node scripts/process-images.mjs
 *
 * 1. Logo: removes the navy background (colour-to-alpha against the background colour, applied
 *    only to the region connected to the image border, so the navy inside the badge is kept)
 *    and writes a transparent PNG plus trimmed icon sizes.
 * 2. Products: upscales each photo with Lanczos-3 to at least 1200px on the long edge, applies a
 *    light sharpen and writes high-quality WebP to public/products/hd/.
 *    Note: upscaling cannot add real detail. For true HD, supply originals >= 1200px.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const pub = (...p) => path.join(root, "public", ...p);

// ───────────── Logo ─────────────
async function processLogo() {
  const src = pub("brand", "porkshop-logo.jpg");
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;

  // Background colour = average of the four corners.
  const bg = [0, 0, 0];
  const corners = [
    [2, 2],
    [W - 3, 2],
    [2, H - 3],
    [W - 3, H - 3],
  ];
  for (const [x, y] of corners) for (let c = 0; c < 3; c++) bg[c] += data[(y * W + x) * 3 + c] / 4;

  const dist = (i) => Math.hypot(data[i * 3] - bg[0], data[i * 3 + 1] - bg[1], data[i * 3 + 2] - bg[2]);

  // 1) Bright artwork (neon ring, white lettering, hat, pink borders) forms a closed silhouette.
  const bright = new Uint8Array(N);
  for (let i = 0; i < N; i++) bright[i] = Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) > 125 ? 1 : 0;

  // Square dilation (separable max filter).
  const dilate = (mask, k) => {
    const tmp = new Uint8Array(N);
    const res = new Uint8Array(N);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let v = 0;
        for (let d = -k; d <= k && !v; d++) {
          const xx = x + d;
          if (xx >= 0 && xx < W && mask[y * W + xx]) v = 1;
        }
        tmp[y * W + x] = v;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let v = 0;
        for (let d = -k; d <= k && !v; d++) {
          const yy = y + d;
          if (yy >= 0 && yy < H && tmp[yy * W + x]) v = 1;
        }
        res[y * W + x] = v;
      }
    return res;
  };

  // 2) Morphological closing: thicken the artwork so small gaps in the ring are sealed, flood
  //    the outside from the border, then grow that outside back by the same amount. Everything
  //    enclosed by the artwork (navy disc, overalls, ribbon fill) stays fully opaque.
  const K = 12;
  const barrier = dilate(bright, K);
  const closedOutside = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  const push = (i) => {
    if (!closedOutside[i] && !barrier[i]) {
      closedOutside[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < W; x++) {
    push(x);
    push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    push(y * W);
    push(y * W + W - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % W;
    const y = (i / W) | 0;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W);
    if (y < H - 1) push(i + W);
  }
  const grown = dilate(closedOutside, K);
  const outside = new Uint8Array(N);
  for (let i = 0; i < N; i++) outside[i] = grown[i] && !bright[i] ? 1 : 0;

  // 3) Keep the artwork's dark outer outline: pixels within 3px of the silhouette stay opaque.
  const region = new Uint8Array(N);
  const R = 3;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!outside[i]) continue;
      let nearArt = false;
      for (let dy = -R; dy <= R && !nearArt; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          if (!outside[yy * W + xx] && dx * dx + dy * dy <= R * R) {
            nearArt = true;
            break;
          }
        }
      }
      region[i] = nearArt ? 0 : 1;
    }
  }

  // Colour-to-alpha (as in GIMP): the smallest alpha such that pixel = a*fg + (1-a)*bg.
  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    let a = 1;
    let fr = r;
    let fg = g;
    let fb = b;
    if (region[i]) {
      a = 0;
      for (const [v, k] of [
        [r, 0],
        [g, 1],
        [b, 2],
      ]) {
        const B = bg[k];
        const need = v > B ? (v - B) / (255 - B) : v < B ? (B - v) / B : 0;
        a = Math.max(a, need);
      }
      // Drop JPEG noise near the background colour, then keep the remaining glow soft.
      a = dist(i) < 22 ? 0 : Math.max(0, (a - 0.1) / 0.9);
      if (a > 0) {
        fr = Math.round(Math.min(255, Math.max(0, (r - bg[0]) / a + bg[0])));
        fg = Math.round(Math.min(255, Math.max(0, (g - bg[1]) / a + bg[1])));
        fb = Math.round(Math.min(255, Math.max(0, (b - bg[2]) / a + bg[2])));
      }
    }
    out[i * 4] = fr;
    out[i * 4 + 1] = fg;
    out[i * 4 + 2] = fb;
    out[i * 4 + 3] = Math.round(a * 255);
  }

  const transparent = sharp(out, { raw: { width: W, height: H, channels: 4 } }).png();
  const trimmed = await transparent.toBuffer().then((b) => sharp(b).trim({ threshold: 2 }).png({ compressionLevel: 9 }).toBuffer());
  fs.writeFileSync(pub("brand", "porkshop-logo.png"), trimmed);

  // Square icon with padding, used for the favicon and home-screen icon.
  const icon = await sharp(trimmed)
    .resize(240, 240, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, quality: 95 })
    .toBuffer();
  fs.writeFileSync(path.join(root, "src", "app", "icon.png"), icon);
  // Apple home-screen icons don't support transparency: put the emblem on the brand navy.
  await sharp({ create: { width: 180, height: 180, channels: 4, background: { r: 16, g: 22, b: 42, alpha: 1 } } })
    .composite([{ input: await sharp(trimmed).resize(150, 150, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), gravity: "center" }])
    .png()
    .toFile(path.join(root, "src", "app", "apple-icon.png"));

  const meta = await sharp(trimmed).metadata();
  console.log(`logo: background rgb(${bg.map(Math.round).join(",")}) removed → ${meta.width}×${meta.height} transparent PNG`);
}

// ───────────── Products ─────────────
async function processProducts() {
  const dir = pub("products");
  const outDir = pub("products", "hd");
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  for (const f of files) {
    const img = sharp(path.join(dir, f));
    const { width, height } = await img.metadata();
    const long = Math.max(width, height);
    const target = Math.max(1200, long);
    const scale = target / long;
    const name = f.replace(/\.(jpe?g|png|webp)$/i, ".webp");
    await sharp(path.join(dir, f))
      .resize(Math.round(width * scale), Math.round(height * scale), { kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: 0.9, m1: 0.6, m2: 1.6 })
      .webp({ quality: 90, effort: 6, smartSubsample: true })
      .toFile(path.join(outDir, name));
    console.log(`${f.padEnd(22)} ${width}×${height} → ${Math.round(width * scale)}×${Math.round(height * scale)}${scale > 1 ? `  (upscaled ${scale.toFixed(1)}×)` : ""}`);
  }
}

await processLogo();
await processProducts();
