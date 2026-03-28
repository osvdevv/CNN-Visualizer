export type Matrix28 = number[][];

type GrayMatrix = number[][];

interface InkBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const TARGET_SIZE = 28;
const INNER_SIZE = 20;

export function preprocessTo28x28(imageData: ImageData): Matrix28 {
  const gray = toGrayscale(imageData);
  const inkBox = findInkBoundingBox(gray);

  if (!inkBox) {
    return createMatrix(TARGET_SIZE, TARGET_SIZE, 0);
  }

  const centered = centerAndResize(gray, inkBox, TARGET_SIZE, TARGET_SIZE);
  return normalize01(centered);
}

export function toGrayscale(imageData: ImageData): GrayMatrix {
  const { data, width, height } = imageData;
  const gray = createMatrix(height, width, 0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      const a = data[idx + 3] / 255;

      // Composite onto white so transparent pixels are interpreted as background.
      const composite = (1 - a) + a * (0.299 * r + 0.587 * g + 0.114 * b);
      gray[y][x] = 1 - composite;
    }
  }

  return gray;
}

export function findInkBoundingBox(gray: GrayMatrix, threshold = 0.05): InkBox | null {
  const height = gray.length;
  const width = gray[0].length;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (gray[y][x] <= threshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

export function centerAndResize(
  gray: GrayMatrix,
  inkBox: InkBox,
  outWidth: number,
  outHeight: number,
): GrayMatrix {
  const contentWidth = inkBox.maxX - inkBox.minX + 1;
  const contentHeight = inkBox.maxY - inkBox.minY + 1;

  const squareSize = Math.max(contentWidth, contentHeight);
  const square = createMatrix(squareSize, squareSize, 0);

  const offsetX = Math.floor((squareSize - contentWidth) / 2);
  const offsetY = Math.floor((squareSize - contentHeight) / 2);

  for (let y = 0; y < contentHeight; y += 1) {
    for (let x = 0; x < contentWidth; x += 1) {
      square[offsetY + y][offsetX + x] = gray[inkBox.minY + y][inkBox.minX + x];
    }
  }

  const resizedInner = resizeBilinear(square, INNER_SIZE, INNER_SIZE);
  const output = createMatrix(outHeight, outWidth, 0);

  const startX = Math.floor((outWidth - INNER_SIZE) / 2);
  const startY = Math.floor((outHeight - INNER_SIZE) / 2);

  for (let y = 0; y < INNER_SIZE; y += 1) {
    for (let x = 0; x < INNER_SIZE; x += 1) {
      output[startY + y][startX + x] = resizedInner[y][x];
    }
  }

  return output;
}

export function normalize01(matrix: GrayMatrix): GrayMatrix {
  return matrix.map((row) => row.map((value) => clamp01(value)));
}

function resizeBilinear(input: GrayMatrix, outWidth: number, outHeight: number): GrayMatrix {
  const srcHeight = input.length;
  const srcWidth = input[0].length;

  if (srcWidth === outWidth && srcHeight === outHeight) {
    return input.map((row) => [...row]);
  }

  const output = createMatrix(outHeight, outWidth, 0);

  for (let y = 0; y < outHeight; y += 1) {
    const srcY = mapCoordinate(y, outHeight, srcHeight);
    const y0 = Math.floor(srcY);
    const y1 = Math.min(y0 + 1, srcHeight - 1);
    const ly = srcY - y0;

    for (let x = 0; x < outWidth; x += 1) {
      const srcX = mapCoordinate(x, outWidth, srcWidth);
      const x0 = Math.floor(srcX);
      const x1 = Math.min(x0 + 1, srcWidth - 1);
      const lx = srcX - x0;

      const top = input[y0][x0] * (1 - lx) + input[y0][x1] * lx;
      const bottom = input[y1][x0] * (1 - lx) + input[y1][x1] * lx;

      output[y][x] = top * (1 - ly) + bottom * ly;
    }
  }

  return output;
}

function mapCoordinate(index: number, outSize: number, srcSize: number): number {
  if (outSize === 1) {
    return 0;
  }

  return (index * (srcSize - 1)) / (outSize - 1);
}

function createMatrix(height: number, width: number, initial: number): GrayMatrix {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => initial));
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}
