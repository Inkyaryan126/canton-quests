const VERSION = 5;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;
const FORMAT_BITS_LOW_MASK_0 = 0x77c4;

type Module = boolean | null;

function gfMultiply(left: number, right: number): number {
  let product = 0;
  let a = left;
  let b = right;
  while (b > 0) {
    if ((b & 1) !== 0) product ^= a;
    a <<= 1;
    if ((a & 0x100) !== 0) a ^= 0x11d;
    b >>= 1;
  }
  return product;
}

function gfPow(power: number): number {
  let value = 1;
  for (let index = 0; index < power; index += 1) {
    value = gfMultiply(value, 2);
  }
  return value;
}

function createGeneratorPolynomial(degree: number): number[] {
  let coefficients = [1];
  for (let index = 0; index < degree; index += 1) {
    const root = gfPow(index);
    const next = Array.from({ length: coefficients.length + 1 }, () => 0);
    coefficients.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= gfMultiply(coefficient, root);
      next[coefficientIndex + 1] ^= coefficient;
    });
    coefficients = next;
  }
  return coefficients.reverse();
}

function createErrorCorrection(data: number[]): number[] {
  const generator = createGeneratorPolynomial(ECC_CODEWORDS);
  const message = [...data, ...Array.from({ length: ECC_CODEWORDS }, () => 0)];

  for (let index = 0; index < data.length; index += 1) {
    const factor = message[index];
    if (factor === 0) continue;
    for (let generatorIndex = 0; generatorIndex < generator.length; generatorIndex += 1) {
      message[index + generatorIndex] ^= gfMultiply(generator[generatorIndex], factor);
    }
  }

  return message.slice(data.length);
}

function appendBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function encodeData(value: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 106) throw new Error('Tracking URL is too long for the built-in QR encoder.');

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(Number.parseInt(bits.slice(index, index + 8).join(''), 2));
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }
  return data;
}

function createEmptyMatrix(): { modules: Module[][]; reserved: boolean[][] } {
  return {
    modules: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null)),
    reserved: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => false)),
  };
}

function setModule(modules: Module[][], reserved: boolean[][], x: number, y: number, value: boolean, isReserved = true) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  modules[y][x] = value;
  if (isReserved) reserved[y][x] = true;
}

function drawFinder(modules: Module[][], reserved: boolean[][], x: number, y: number) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      const inCore = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inCore && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setModule(modules, reserved, xx, yy, dark);
    }
  }
}

function drawAlignment(modules: Module[][], reserved: boolean[][], centerX: number, centerY: number) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(modules, reserved, centerX + dx, centerY + dy, distance !== 1);
    }
  }
}

function drawFunctionPatterns(modules: Module[][], reserved: boolean[][]) {
  drawFinder(modules, reserved, 0, 0);
  drawFinder(modules, reserved, SIZE - 7, 0);
  drawFinder(modules, reserved, 0, SIZE - 7);
  drawAlignment(modules, reserved, 30, 30);

  for (let index = 8; index < SIZE - 8; index += 1) {
    const dark = index % 2 === 0;
    setModule(modules, reserved, index, 6, dark);
    setModule(modules, reserved, 6, index, dark);
  }

  setModule(modules, reserved, 8, 4 * VERSION + 9, true);

  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      setModule(modules, reserved, 8, index, false);
      setModule(modules, reserved, index, 8, false);
    }
  }
  for (let index = SIZE - 8; index < SIZE; index += 1) {
    setModule(modules, reserved, 8, index, false);
    setModule(modules, reserved, index, 8, false);
  }
}

function placeData(modules: Module[][], reserved: boolean[][], codewords: number[]) {
  const bits: number[] = [];
  codewords.forEach((codeword) => appendBits(bits, codeword, 8));

  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = right - dx;
        if (reserved[y][x]) continue;
        const rawBit = bits[bitIndex] === 1;
        const masked = (x + y) % 2 === 0 ? !rawBit : rawBit;
        modules[y][x] = masked;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function drawFormatBits(modules: Module[][], reserved: boolean[][]) {
  const bit = (index: number) => ((FORMAT_BITS_LOW_MASK_0 >>> index) & 1) !== 0;

  for (let index = 0; index <= 5; index += 1) setModule(modules, reserved, 8, index, bit(index));
  setModule(modules, reserved, 8, 7, bit(6));
  setModule(modules, reserved, 8, 8, bit(7));
  setModule(modules, reserved, 7, 8, bit(8));
  for (let index = 9; index < 15; index += 1) setModule(modules, reserved, 14 - index, 8, bit(index));

  for (let index = 0; index < 8; index += 1) setModule(modules, reserved, SIZE - 1 - index, 8, bit(index));
  for (let index = 8; index < 15; index += 1) setModule(modules, reserved, 8, SIZE - 15 + index, bit(index));
}

function createQrMatrix(value: string): boolean[][] {
  const data = encodeData(value);
  const codewords = [...data, ...createErrorCorrection(data)];
  const { modules, reserved } = createEmptyMatrix();
  drawFunctionPatterns(modules, reserved);
  placeData(modules, reserved, codewords);
  drawFormatBits(modules, reserved);
  return modules.map((row) => row.map(Boolean));
}

export function createQrSvgDataUri(value: string): string {
  const matrix = createQrMatrix(value);
  const moduleSize = 8;
  const quietZone = 4;
  const imageSize = (SIZE + quietZone * 2) * moduleSize;
  const rects: string[] = [];

  matrix.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (!filled) return;
      rects.push(
        `<rect x="${(x + quietZone) * moduleSize}" y="${(y + quietZone) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`
      );
    });
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imageSize} ${imageSize}" role="img"><rect width="${imageSize}" height="${imageSize}" fill="#fff"/><g fill="#050607">${rects.join('')}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
