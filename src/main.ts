import './style.css';
import { DrawCanvas } from './canvas/DrawCanvas';
import { PixelGrid } from './canvas/PixelGrid';
import { preprocessTo28x28 } from './canvas/preprocess';
import { loadModel } from './nn/model';
import { predictDigit } from './nn/predict';
import { PredictionPanel } from './ui/PredictionPanel';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root element #app was not found.');
}

app.innerHTML = `
  <main class="layout">
    <header class="hero">
      <p class="eyebrow">Phase 1 Baseline</p>
      <h1>CNN Visualizer</h1>
      <p class="subtitle">Dibuja un digito, preprocesa a 28x28 y ejecuta inferencia MNIST en el navegador.</p>
      <div class="status-wrap">
        <span id="model-status" class="pill loading">Cargando modelo...</span>
        <button id="retry-model" class="btn subtle" type="button" hidden>Retry model load</button>
      </div>
      <p id="model-error" class="error" role="alert" hidden></p>
    </header>

    <section class="workspace">
      <div class="card draw-card">
        <h2>Draw Canvas</h2>
        <canvas id="draw-canvas" width="280" height="280" aria-label="Digit drawing canvas"></canvas>
        <div class="actions">
          <button id="predict-btn" class="btn primary" type="button">Predict</button>
          <button id="clear-btn" class="btn" type="button">Clear</button>
        </div>
      </div>

      <div class="card preview-card">
        <h2>Model Input 28x28</h2>
        <canvas id="pixel-grid" width="140" height="140" aria-label="Preprocessed 28 by 28 preview"></canvas>
      </div>

      <div class="card result-card">
        <h2>Prediction</h2>
        <div class="top-result">
          <p class="label">Top class</p>
          <p id="top-class" class="top-class">-</p>
          <p id="top-confidence" class="top-confidence">0.00%</p>
        </div>
        <ul id="confidence-list" class="scores" aria-label="Class confidence list"></ul>
      </div>
    </section>
  </main>
`;

const drawCanvasEl = document.querySelector<HTMLCanvasElement>('#draw-canvas');
const pixelGridEl = document.querySelector<HTMLCanvasElement>('#pixel-grid');
const predictBtnEl = document.querySelector<HTMLButtonElement>('#predict-btn');
const clearBtnEl = document.querySelector<HTMLButtonElement>('#clear-btn');
const retryModelBtnEl = document.querySelector<HTMLButtonElement>('#retry-model');
const modelStatusElRef = document.querySelector<HTMLElement>('#model-status');
const modelErrorElRef = document.querySelector<HTMLElement>('#model-error');
const topClassEl = document.querySelector<HTMLElement>('#top-class');
const topConfidenceEl = document.querySelector<HTMLElement>('#top-confidence');
const confidenceListEl = document.querySelector<HTMLElement>('#confidence-list');

if (
  !drawCanvasEl ||
  !pixelGridEl ||
  !predictBtnEl ||
  !clearBtnEl ||
  !retryModelBtnEl ||
  !modelStatusElRef ||
  !modelErrorElRef ||
  !topClassEl ||
  !topConfidenceEl ||
  !confidenceListEl
) {
  throw new Error('Failed to initialize UI elements.');
}

const predictBtn = predictBtnEl;
const clearBtn = clearBtnEl;
const retryModelBtn = retryModelBtnEl;
const modelStatusEl = modelStatusElRef;
const modelErrorEl = modelErrorElRef;

const drawCanvas = new DrawCanvas(drawCanvasEl);
const pixelGrid = new PixelGrid(pixelGridEl);
const predictionPanel = new PredictionPanel(topClassEl, topConfidenceEl, confidenceListEl);

let modelReady = false;
let modelError: string | null = null;

function setModelState(loading: boolean, errorMessage: string | null): void {
  modelError = errorMessage;
  modelReady = !loading && !errorMessage;

  if (loading) {
    modelStatusEl.textContent = 'Cargando modelo...';
    modelStatusEl.className = 'pill loading';
    modelErrorEl.hidden = true;
    retryModelBtn.hidden = true;
  } else if (errorMessage) {
    modelStatusEl.textContent = 'Error al cargar modelo';
    modelStatusEl.className = 'pill error';
    modelErrorEl.hidden = false;
    modelErrorEl.textContent = errorMessage;
    retryModelBtn.hidden = false;
  } else {
    modelStatusEl.textContent = 'Modelo listo';
    modelStatusEl.className = 'pill ok';
    modelErrorEl.hidden = true;
    retryModelBtn.hidden = true;
  }
}

async function initModel(forceReload = false): Promise<void> {
  setModelState(true, null);

  try {
    await loadModel(forceReload);
    setModelState(false, null);
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message}. Verifica public/model/model.json y shards.`
        : 'No se pudo cargar el modelo.';

    setModelState(false, message);
  }
}

predictBtn.addEventListener('click', async () => {
  if (!modelReady) {
    setModelState(false, modelError ?? 'Modelo no disponible. Intenta recargar.');
    return;
  }

  predictBtn.disabled = true;
  predictBtn.textContent = 'Predicting...';

  try {
    const imageData = drawCanvas.exportImageData();
    const matrix = preprocessTo28x28(imageData);
    pixelGrid.update(matrix);

    const model = await loadModel();
    const result = await predictDigit(model, matrix);
    predictionPanel.render(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown prediction error';
    setModelState(false, message);
  } finally {
    predictBtn.disabled = false;
    predictBtn.textContent = 'Predict';
  }
});

clearBtn.addEventListener('click', () => {
  drawCanvas.clear();
  pixelGrid.clear();
  predictionPanel.reset();
});

retryModelBtn.addEventListener('click', async () => {
  await initModel(true);
});

void initModel();
