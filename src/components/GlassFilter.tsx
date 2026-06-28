import { onMount, onCleanup } from 'solid-js';

/**
 * GlassFilter — injects the SVG displacement filter that powers the true
 * "liquid glass" refraction on hero surfaces (dialogs, title bar).
 *
 * Technique (per glass.outpacestudios.com):
 *   - A displacement map is generated on a <canvas>: each pixel's R/G channel
 *     encodes a horizontal/vertical offset, with 128 = neutral (no shift).
 *   - The map models a squircle lens: near the rim the surface slope steepens,
 *     so light bends outward (refraction); the center stays undistorted.
 *   - The map is handed to <feDisplacementMap> via <feImage>. WebKit refuses
 *     data URIs inside feImage, so we deliver a Blob URL.
 *   - color-interpolation-filters="sRGB" keeps displacement values literal
 *     (filters default to linearRGB, which would skew the offsets).
 *
 * CSS then references it: `backdrop-filter: blur(..) url(#lg-refraction)`.
 * Because Electron is Chromium, backdrop-filter + SVG filter refs are GPU
 * accelerated. If the ref ever no-ops, the blur fallback still yields glass.
 */

const FILTER_ID = 'lg-refraction';
const MAP_SIZE = 256; // resolution of the lens map; stretched to any panel size
const FILTER_SCALE = 0.052;

function createDisplacementCanvas(): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
  const data = img.data;

  const exponent = 4.8; // superellipse exponent -> squircle lens
  const rimWidth = 0.26; // only the edge bends; center stays optically flat
  const ior = 1.5; // glass-like index of refraction
  const gain = 1.12;

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  for (let py = 0; py < MAP_SIZE; py++) {
    for (let px = 0; px < MAP_SIZE; px++) {
      // Normalized coords in [-1, 1].
      const nx = (px / (MAP_SIZE - 1)) * 2 - 1;
      const ny = (py / (MAP_SIZE - 1)) * 2 - 1;

      // Superellipse radius: r = (|nx|^p + |ny|^p)^(1/p). r=1 at the rim.
      const ax = Math.abs(nx);
      const ay = Math.abs(ny);
      const r = Math.pow(Math.pow(ax, exponent) + Math.pow(ay, exponent), 1 / exponent);

      let dx = 0;
      let dy = 0;
      let specular = 0;
      if (r > 0.0001 && r < 1) {
        // Outward direction = gradient of the superellipse field.
        let gx = Math.sign(nx) * Math.pow(ax, exponent - 1);
        let gy = Math.sign(ny) * Math.pow(ay, exponent - 1);
        const glen = Math.hypot(gx, gy) || 1;
        gx /= glen;
        gy /= glen;

        // x is depth from the rim: 0 at the edge, 1 in the flat center.
        // The Outpace article's key point is that the bend belongs at the rim,
        // not across the whole pane, so the center remains neutral.
        const x = clamp01((1 - r) / rimWidth);
        const rim = 1 - x;
        if (rim > 0) {
          const denom = Math.pow(Math.max(1 - Math.pow(rim, 4), 0.0001), 0.75);
          const slope = Math.pow(rim, 3) / denom;
          const thetaI = Math.atan(slope);
          const thetaT = Math.asin(Math.sin(thetaI) / ior);
          const bend = Math.sin(thetaI - thetaT);
          const amount = clamp01(bend * gain);
          dx = gx * amount;
          dy = gy * amount;
          specular = Math.pow(rim, 2.2) * (0.72 + 0.28 * Math.max(0, -gy));
        }
      }

      const i = (py * MAP_SIZE + px) * 4;
      data[i] = Math.round((Math.max(-1, Math.min(1, dx)) * 0.5 + 0.5) * 255); // R
      data[i + 1] = Math.round((Math.max(-1, Math.min(1, dy)) * 0.5 + 0.5) * 255); // G
      data[i + 2] = Math.round(128 + clamp01(specular) * 127); // B carries rim height
      data[i + 3] = 255; // A
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function buildDisplacementMapDataUrl(): string {
  return createDisplacementCanvas()?.toDataURL('image/png') ?? '';
}

export function GlassFilter() {
  let feImage: SVGFEImageElement | undefined;
  let blobUrl: string | undefined;
  let disposed = false;

  onMount(() => {
    if (!feImage) return;
    const canvas = createDisplacementCanvas();
    if (!canvas) {
      const url = buildDisplacementMapDataUrl();
      if (url) feImage.setAttribute('href', url);
      return;
    }

    canvas.toBlob((blob) => {
      if (disposed || !feImage) return;
      if (!blob) {
        const fallback = canvas.toDataURL('image/png');
        if (fallback) feImage.setAttribute('href', fallback);
        return;
      }
      blobUrl = URL.createObjectURL(blob);
      feImage.setAttribute('href', blobUrl);
    }, 'image/png');
  });

  onCleanup(() => {
    disposed = true;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  });

  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <filter
        id={FILTER_ID}
        x="0"
        y="0"
        width="100%"
        height="100%"
        color-interpolation-filters="sRGB"
        filterUnits="objectBoundingBox"
        primitiveUnits="objectBoundingBox"
      >
        <feImage
          ref={feImage}
          x="0"
          y="0"
          width="1"
          height="1"
          preserveAspectRatio="none"
          result="lgmap"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="lgmap"
          scale={FILTER_SCALE}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
