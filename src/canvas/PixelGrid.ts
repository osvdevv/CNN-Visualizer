import type { Matrix28 } from './preprocess';

export class PixelGrid {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pixelSize = 5;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Pixel grid 2D context is not available.');
    }

    this.canvas = canvas;
    this.ctx = ctx;

    this.canvas.width = 28 * this.pixelSize;
    this.canvas.height = 28 * this.pixelSize;

    this.clear();
  }

  update(matrix: Matrix28): void {
    for (let y = 0; y < 28; y += 1) {
      for (let x = 0; x < 28; x += 1) {
        const value = clamp01(matrix[y][x]);
        const shade = Math.round((1 - value) * 255);
        this.ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
        this.ctx.fillRect(x * this.pixelSize, y * this.pixelSize, this.pixelSize, this.pixelSize);
      }
    }
  }

  clear(): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
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
