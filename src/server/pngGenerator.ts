import { deflateSync } from 'node:zlib';

// Compact 5x7 bitmap font for crisp, OCR-readable scanned document PNG generation
const FONT_5X7: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  'D': ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  'J': ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '@': ['01110', '10001', '10111', '10101', '10111', '10000', '01110'],
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export interface ScannedDocOptions {
  headerTitle: string;
  subHeader: string;
  stampText: string;
  stampColor?: [number, number, number];
  lines: string[];
  footerNote: string;
}

export function renderScannedDocumentPngDataUrl(opts: ScannedDocOptions): string {
  const width = 920;
  const height = 620;
  const rgb = Buffer.alloc(width * height * 3);

  // Fill off-white scanned paper background with subtle horizontal scan grain
  for (let y = 0; y < height; y++) {
    const lineTint = y % 6 === 0 ? -4 : 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const noise = ((x * 37 + y * 17) % 7) - 3;
      rgb[idx] = Math.min(255, Math.max(0, 249 + lineTint + noise));
      rgb[idx + 1] = Math.min(255, Math.max(0, 247 + lineTint + noise));
      rgb[idx + 2] = Math.min(255, Math.max(0, 241 + lineTint + noise));
    }
  }

  const setPixel = (px: number, py: number, r: number, g: number, b: number) => {
    if (px < 0 || px >= width || py < 0 || py >= height) return;
    const idx = (py * width + px) * 3;
    rgb[idx] = r;
    rgb[idx + 1] = g;
    rgb[idx + 2] = b;
  };

  const drawRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        setPixel(xx, yy, r, g, b);
      }
    }
  };

  const drawBorder = (x: number, y: number, w: number, h: number, t: number, r: number, g: number, b: number) => {
    drawRect(x, y, w, t, r, g, b);
    drawRect(x, y + h - t, w, t, r, g, b);
    drawRect(x, y, t, h, r, g, b);
    drawRect(x + w - t, y, t, h, r, g, b);
  };

  const drawText = (text: string, startX: number, startY: number, scale: number, r: number, g: number, b: number) => {
    const upper = text.toUpperCase();
    let cursorX = startX;
    for (let i = 0; i < upper.length; i++) {
      const ch = upper[i];
      const glyph = FONT_5X7[ch] ?? FONT_5X7[' '];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === '1') {
            drawRect(cursorX + col * scale, startY + row * scale, scale, scale, r, g, b);
          }
        }
      }
      cursorX += 6 * scale;
    }
  };

  // Outer form frame and header band
  drawBorder(24, 24, width - 48, height - 48, 2, 45, 55, 72);
  drawRect(26, 26, width - 52, 74, 234, 238, 243);
  drawRect(26, 100, width - 52, 2, 45, 55, 72);

  // Header text
  drawText(opts.headerTitle, 44, 42, 3, 15, 23, 42);
  drawText(opts.subHeader, 44, 74, 2, 71, 85, 105);

  // Official ink stamp box on top-right
  const [sr, sg, sb] = opts.stampColor ?? [185, 28, 28];
  const stampW = Math.min(280, Math.max(160, opts.stampText.length * 12 + 32));
  const stampX = width - 44 - stampW;
  drawBorder(stampX, 122, stampW, 44, 3, sr, sg, sb);
  drawText(opts.stampText, stampX + 16, 137, 2, sr, sg, sb);

  // Body lines
  let y = 134;
  for (const line of opts.lines) {
    if (line.startsWith('---')) {
      drawRect(44, y + 6, width - 88, 1, 180, 190, 200);
      y += 22;
      continue;
    }
    const isKeyLine = line.includes(':');
    drawText(line, 44, y, 2, isKeyLine ? 15 : 51, isKeyLine ? 23 : 65, isKeyLine ? 42 : 85);
    y += 28;
  }

  // Footer band
  drawRect(26, height - 74, width - 52, 1, 180, 190, 200);
  drawText(opts.footerNote, 44, height - 56, 2, 100, 116, 139);

  // Encode raw scanlines with filter byte 0
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    raw[row * (stride + 1)] = 0;
    rgb.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const pngBuffer = Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);

  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
