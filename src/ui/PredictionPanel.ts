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

    const emptyRows = Array.from({ length: 10 }, (_, digit) => this.renderCard(digit, 0, false)).join('');
    this.listEl.innerHTML = emptyRows;
  }

  render(result: PredictionResult): void {
    this.topClassEl.textContent = String(result.topClass);
    this.topConfidenceEl.textContent = `${(result.topConfidence * 100).toFixed(2)}%`;

    const rows = result.confidences
      .map((confidence, digit) => this.renderCard(digit, confidence, digit === result.topClass))
      .join('');

    this.listEl.innerHTML = rows;
  }

  private renderCard(digit: number, confidence: number, isTop: boolean): string {
    const percent = (confidence * 100).toFixed(2);
    const fill = confidence > 0 ? `${Math.max(confidence * 100, 4)}%` : '0%';

    return `
      <li class="score-card${isTop ? ' is-top' : ''}">
        <div class="score-card-head">
          <span class="score-digit-badge">${digit}</span>
          <span class="score-card-value">${percent}%</span>
        </div>
        <div class="score-bar-track score-card-track">
          <div class="score-bar-fill score-card-fill" style="width: ${fill};"></div>
        </div>
        <span class="score-card-label">${isTop ? 'Prediccion' : 'Clase'}</span>
      </li>
    `;
  }
}
