import type { PredictionResult } from '../nn/predict';

export class PredictionPanel {
  private readonly topClassEl: HTMLElement;
  private readonly topConfidenceEl: HTMLElement;
  private readonly listEl: HTMLElement;

  constructor(topClassEl: HTMLElement, topConfidenceEl: HTMLElement, listEl: HTMLElement) {
    this.topClassEl = topClassEl;
    this.topConfidenceEl = topConfidenceEl;
    this.listEl = listEl;

    this.reset();
  }

  reset(): void {
    this.topClassEl.textContent = '-';
    this.topConfidenceEl.textContent = '0.00%';

    const emptyRows = Array.from({ length: 10 }, (_, digit) => this.renderRow(digit, 0)).join('');
    this.listEl.innerHTML = emptyRows;
  }

  render(result: PredictionResult): void {
    this.topClassEl.textContent = String(result.topClass);
    this.topConfidenceEl.textContent = `${(result.topConfidence * 100).toFixed(2)}%`;

    const rows = result.confidences
      .map((confidence, digit) => this.renderRow(digit, confidence))
      .join('');

    this.listEl.innerHTML = rows;
  }

  private renderRow(digit: number, confidence: number): string {
    const percent = (confidence * 100).toFixed(2);

    return `
      <li class="score-row">
        <span class="score-digit">${digit}</span>
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width: ${percent}%;"></div>
        </div>
        <span class="score-value">${percent}%</span>
      </li>
    `;
  }
}
