export class DrawCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private readonly lineWidth: number;
  private hasInk = false;
  private changeListener: ((hasInk: boolean) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, lineWidth = 20) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available.');
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.lineWidth = lineWidth;

    this.setupCanvas();
    this.bindEvents();
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.hasInk) {
      this.hasInk = false;
      this.notifyChange();
    }
  }

  exportImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  hasStroke(minPixels = 24): boolean {
    if (!this.hasInk) {
      return false;
    }

    const { data } = this.exportImageData();
    let paintedPixels = 0;

    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) {
        paintedPixels += 1;
        if (paintedPixels >= minPixels) {
          this.hasInk = true;
          return true;
        }
      }
    }

    this.hasInk = false;
    return false;
  }

  setOnChangeListener(listener: ((hasInk: boolean) => void) | null): void {
    this.changeListener = listener;
  }

  private setupCanvas(): void {
    this.canvas.width = 280;
    this.canvas.height = 280;
    this.canvas.style.touchAction = 'none';

    this.ctx.lineWidth = this.lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#000000';
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.isDrawing = true;
    this.canvas.setPointerCapture(event.pointerId);

    const { x, y } = this.toCanvasCoordinates(event);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    if (!this.hasInk) {
      this.hasInk = true;
      this.notifyChange();
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDrawing) {
      return;
    }

    const { x, y } = this.toCanvasCoordinates(event);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.isDrawing) {
      return;
    }

    this.isDrawing = false;
    this.ctx.closePath();

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private toCanvasCoordinates(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  private notifyChange(): void {
    this.changeListener?.(this.hasInk);
  }
}
