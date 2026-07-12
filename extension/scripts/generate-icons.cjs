// Icon generator: draws a simple blue-square + white-checkmark logo (no
// external image deps, since PNG is written by hand via zlib deflate).
// Swap public/icons/*.png for real artwork whenever convenient.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Shortest distance from point (px, py) to segment (x1,y1)-(x2,y2).
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function makePng(size, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type: RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const rowLen = size * 4;
  const raw = Buffer.alloc((rowLen + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowLen + 1);
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const px = rowStart + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const BLUE = [26, 115, 232, 255]; // #1a73e8, Gmail-ish blue
const WHITE = [255, 255, 255, 255];

function logoPixel(size) {
  const n = size;
  const corner = n * 0.18; // rounded-square corner radius
  const strokeHalfWidth = Math.max(1, n * 0.09);

  // Checkmark as two segments, in a square coordinate space of size n.
  const p1 = [n * 0.22, n * 0.53];
  const p2 = [n * 0.42, n * 0.74];
  const p3 = [n * 0.79, n * 0.28];

  return (x, y) => {
    const cx = x + 0.5;
    const cy = y + 0.5;

    // Rounded-square clip: outside the rounded corners -> transparent.
    const nearestCornerX = cx < corner ? corner : cx > n - corner ? n - corner : cx;
    const nearestCornerY = cy < corner ? corner : cy > n - corner ? n - corner : cy;
    const inCornerZone = (cx < corner || cx > n - corner) && (cy < corner || cy > n - corner);
    if (inCornerZone && Math.hypot(cx - nearestCornerX, cy - nearestCornerY) > corner) {
      return [0, 0, 0, 0];
    }

    const d1 = distToSegment(cx, cy, p1[0], p1[1], p2[0], p2[1]);
    const d2 = distToSegment(cx, cy, p2[0], p2[1], p3[0], p3[1]);
    if (Math.min(d1, d2) <= strokeHalfWidth) {
      return WHITE;
    }
    return BLUE;
  };
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = makePng(size, logoPixel(size));
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`wrote icon${size}.png`);
}
