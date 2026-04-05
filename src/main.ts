import './style.css';
import { DrawCanvas } from './canvas/DrawCanvas';
import { PixelGrid } from './canvas/PixelGrid';
import { preprocessTo28x28 } from './canvas/preprocess';
import { loadModel } from './nn/model';
import { predictDigitDetailed } from './nn/predict';
import { PredictionPanel } from './ui/PredictionPanel';
import type { NetworkVisualizer3D } from './visualization/NetworkVisualizer3D';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root element #app was not found.');
}

app.innerHTML = `
  <main id="app-shell" class="app-shell is-idle">
    <header class="topbar">
      <div class="brand-block">
        <span class="brand-dot" aria-hidden="true"></span>
        <div>
          <p class="brand-title">CNN Visualizer</p>
          <p class="brand-subtitle">Sigue tu numero a traves de la red.</p>
        </div>
      </div>

      <div class="system-block">
        <div class="status-wrap">
          <span id="model-status" class="pill loading">Cargando modelo...</span>
          <button id="retry-model" class="btn subtle" type="button" hidden>Reintentar modelo</button>
        </div>
        <p id="model-error" class="error" role="alert" hidden></p>
      </div>
    </header>

    <section class="experience">
      <aside class="card input-panel">
        <div class="input-panel-intro">
          <p class="draw-label">Draw Here</p>
          <p class="input-copy">Traza un numero del 0 al 9 y luego deja que la app te muestre como la CNN lo entiende paso a paso.</p>
        </div>

        <div class="draw-stage">
          <canvas id="draw-canvas" width="280" height="280" aria-label="Digit drawing canvas"></canvas>
        </div>

        <div class="actions">
          <button id="predict-btn" class="btn primary" type="button">Ver como lo interpreta</button>
          <button id="clear-btn" class="btn ghost" type="button">Empezar de nuevo</button>
        </div>

        <div class="canvas-guidance" aria-live="polite">
          <span id="draw-state-pill" class="canvas-state-pill" data-state="idle">Esperando trazo</span>
          <p id="draw-helper" class="canvas-helper">Dibuja un numero para activar el analisis.</p>
        </div>

        <div class="input-insights">
          <section class="mini-panel preview-panel">
            <div class="mini-head">
              <span>Entrada del modelo</span>
              <strong>28x28</strong>
            </div>
            <canvas id="pixel-grid" width="140" height="140" aria-label="Preprocessed 28 by 28 preview"></canvas>
          </section>

          <section class="mini-panel result-panel">
            <div class="prediction-summary">
              <div>
                <p class="mini-kicker">Prediccion principal</p>
                <p id="top-class" class="top-class">-</p>
              </div>
              <p id="top-confidence" class="top-confidence">0.00%</p>
            </div>
            <ul id="confidence-list" class="scores" aria-label="Class confidence list"></ul>
          </section>
        </div>
      </aside>

      <section class="analysis-panel">
        <div class="analysis-header">
          <div>
            <p class="analysis-kicker">Recorrido del modelo</p>
            <h2>Tu numero dentro de la CNN</h2>
            <p class="analysis-copy">La animacion sigue la entrada desde el canvas, atraviesa cada bloque de la red y te va contando que esta haciendo en cada etapa.</p>
          </div>

          <div class="analysis-actions">
            <button id="replay-btn" class="btn subtle replay-btn" type="button" hidden>Replay walkthrough</button>
            <div class="flow-nodes" aria-label="Neural network flow stages">
              <span id="viz-node-input" class="flow-node node-input">Canvas</span>
              <span id="viz-node-preprocess" class="flow-node node-preprocess">28x28</span>
              <span id="viz-node-conv" class="flow-node node-conv">Conv</span>
              <span id="viz-node-pool" class="flow-node node-pool">Pool</span>
              <span id="viz-node-flatten" class="flow-node node-flatten">Flatten</span>
              <span id="viz-node-dense" class="flow-node node-dense">Dense</span>
              <span id="viz-node-output" class="flow-node node-output">Softmax</span>
            </div>
          </div>
        </div>

        <div class="card analysis-shell">
          <div class="visualizer-stack">
            <div class="story-banner">
              <span id="viz-stage-pill" class="story-pill">Stand by</span>
              <p id="viz-stage-line" class="story-line">La escena esta lista para narrar el recorrido completo de tu numero.</p>
            </div>

            <div id="network-visualizer" class="visualizer-viewport" aria-label="3D CNN inference visualization"></div>
          </div>

          <aside class="visualizer-sidebar">
            <ol class="viz-steps">
              <li id="viz-phase-preprocess" class="viz-step step-preprocess">
                <strong>1. Preparando la entrada</strong>
                <span>Del canvas al 28x28 que consume la red</span>
              </li>
              <li id="viz-phase-cnn" class="viz-step step-cnn">
                <strong>2. Recorriendo la CNN</strong>
                <span>Conv, Pooling, Flatten y Dense</span>
              </li>
              <li id="viz-phase-activations" class="viz-step step-activations">
                <strong>3. Activaciones intermedias</strong>
                <span>Que zonas y patrones estan mas encendidos</span>
              </li>
              <li id="viz-phase-output" class="viz-step step-output">
                <strong>4. Decision final</strong>
                <span>Distribucion de confianza entre los 10 digitos</span>
              </li>
            </ol>

            <div class="viz-detail">
              <p id="viz-detail-title" class="viz-detail-title">Listo para analizar</p>
              <p id="viz-detail-copy" class="viz-detail-copy">Cuando pulses el boton, la vista se convertira en un recorrido guiado de la prediccion.</p>
            </div>

            <div id="viz-metrics" class="viz-metrics"></div>
          </aside>
        </div>
      </section>
    </section>

    <div id="canvas-flight" class="canvas-flight" hidden aria-hidden="true">
      <canvas id="canvas-flight-canvas" class="canvas-flight-canvas" width="280" height="280"></canvas>
    </div>
  </main>
`;

const appShellEl = document.querySelector<HTMLElement>('#app-shell');
const drawStageEl = document.querySelector<HTMLElement>('.draw-stage');
const drawCanvasEl = document.querySelector<HTMLCanvasElement>('#draw-canvas');
const pixelGridEl = document.querySelector<HTMLCanvasElement>('#pixel-grid');
const predictBtnEl = document.querySelector<HTMLButtonElement>('#predict-btn');
const clearBtnEl = document.querySelector<HTMLButtonElement>('#clear-btn');
const retryModelBtnEl = document.querySelector<HTMLButtonElement>('#retry-model');
const replayBtnEl = document.querySelector<HTMLButtonElement>('#replay-btn');
const drawStatePillEl = document.querySelector<HTMLElement>('#draw-state-pill');
const drawHelperEl = document.querySelector<HTMLElement>('#draw-helper');
const modelStatusElRef = document.querySelector<HTMLElement>('#model-status');
const modelErrorElRef = document.querySelector<HTMLElement>('#model-error');
const topClassEl = document.querySelector<HTMLElement>('#top-class');
const topConfidenceEl = document.querySelector<HTMLElement>('#top-confidence');
const confidenceListEl = document.querySelector<HTMLElement>('#confidence-list');
const visualizerEl = document.querySelector<HTMLElement>('#network-visualizer');
const canvasFlightEl = document.querySelector<HTMLElement>('#canvas-flight');
const canvasFlightCanvasEl = document.querySelector<HTMLCanvasElement>('#canvas-flight-canvas');
const vizDetailTitleEl = document.querySelector<HTMLElement>('#viz-detail-title');
const vizDetailCopyEl = document.querySelector<HTMLElement>('#viz-detail-copy');
const vizMetricsEl = document.querySelector<HTMLElement>('#viz-metrics');
const vizStagePillEl = document.querySelector<HTMLElement>('#viz-stage-pill');
const vizStageLineEl = document.querySelector<HTMLElement>('#viz-stage-line');
const vizPhasePreprocessEl = document.querySelector<HTMLElement>('#viz-phase-preprocess');
const vizPhaseCnnEl = document.querySelector<HTMLElement>('#viz-phase-cnn');
const vizPhaseActivationsEl = document.querySelector<HTMLElement>('#viz-phase-activations');
const vizPhaseOutputEl = document.querySelector<HTMLElement>('#viz-phase-output');
const vizNodeInputEl = document.querySelector<HTMLElement>('#viz-node-input');
const vizNodePreprocessEl = document.querySelector<HTMLElement>('#viz-node-preprocess');
const vizNodeConvEl = document.querySelector<HTMLElement>('#viz-node-conv');
const vizNodePoolEl = document.querySelector<HTMLElement>('#viz-node-pool');
const vizNodeFlattenEl = document.querySelector<HTMLElement>('#viz-node-flatten');
const vizNodeDenseEl = document.querySelector<HTMLElement>('#viz-node-dense');
const vizNodeOutputEl = document.querySelector<HTMLElement>('#viz-node-output');

if (
  !appShellEl ||
  !drawStageEl ||
  !drawCanvasEl ||
  !pixelGridEl ||
  !predictBtnEl ||
  !clearBtnEl ||
  !retryModelBtnEl ||
  !replayBtnEl ||
  !drawStatePillEl ||
  !drawHelperEl ||
  !modelStatusElRef ||
  !modelErrorElRef ||
  !topClassEl ||
  !topConfidenceEl ||
  !confidenceListEl ||
  !visualizerEl ||
  !canvasFlightEl ||
  !canvasFlightCanvasEl ||
  !vizDetailTitleEl ||
  !vizDetailCopyEl ||
  !vizMetricsEl ||
  !vizStagePillEl ||
  !vizStageLineEl ||
  !vizPhasePreprocessEl ||
  !vizPhaseCnnEl ||
  !vizPhaseActivationsEl ||
  !vizPhaseOutputEl ||
  !vizNodeInputEl ||
  !vizNodePreprocessEl ||
  !vizNodeConvEl ||
  !vizNodePoolEl ||
  !vizNodeFlattenEl ||
  !vizNodeDenseEl ||
  !vizNodeOutputEl
) {
  throw new Error('Failed to initialize UI elements.');
}

const appShell = appShellEl;
const drawStage = drawStageEl;
const drawCanvasElement = drawCanvasEl;
const predictBtn = predictBtnEl;
const clearBtn = clearBtnEl;
const retryModelBtn = retryModelBtnEl;
const replayBtn = replayBtnEl;
const drawStatePill = drawStatePillEl;
const drawHelper = drawHelperEl;
const modelStatusEl = modelStatusElRef;
const modelErrorEl = modelErrorElRef;
const visualizerContainerEl = visualizerEl;
const canvasFlight = canvasFlightEl;
const canvasFlightCanvas = canvasFlightCanvasEl;
const vizDetailTitle = vizDetailTitleEl;
const vizDetailCopy = vizDetailCopyEl;
const vizMetrics = vizMetricsEl;
const vizStagePill = vizStagePillEl;
const vizStageLine = vizStageLineEl;
const vizPhasePreprocess = vizPhasePreprocessEl;
const vizPhaseCnn = vizPhaseCnnEl;
const vizPhaseActivations = vizPhaseActivationsEl;
const vizPhaseOutput = vizPhaseOutputEl;
const vizNodeInput = vizNodeInputEl;
const vizNodePreprocess = vizNodePreprocessEl;
const vizNodeConv = vizNodeConvEl;
const vizNodePool = vizNodePoolEl;
const vizNodeFlatten = vizNodeFlattenEl;
const vizNodeDense = vizNodeDenseEl;
const vizNodeOutput = vizNodeOutputEl;

const drawCanvas = new DrawCanvas(drawCanvasEl);
const pixelGrid = new PixelGrid(pixelGridEl);
const predictionPanel = new PredictionPanel(topClassEl, topConfidenceEl, confidenceListEl);
const canvasFlightCtx = canvasFlightCanvas.getContext('2d');

if (!canvasFlightCtx) {
  throw new Error('Canvas flight 2D context is not available.');
}

const canvasFlightContext = canvasFlightCtx;

let networkVisualizer: NetworkVisualizer3D | null = null;
let networkVisualizerPromise: Promise<NetworkVisualizer3D> | null = null;
let modelReady = false;
let modelError: string | null = null;
let flightAnimationPromise: Promise<void> | null = null;
let lastAnalysis: { result: Awaited<ReturnType<typeof predictDigitDetailed>>; imageData: ImageData } | null = null;
let hasStroke = false;
let guidanceResetTimeout = 0;
let isAnalyzing = false;

function ensureNetworkVisualizer(): Promise<NetworkVisualizer3D> {
  if (networkVisualizer) {
    return Promise.resolve(networkVisualizer);
  }

  if (!networkVisualizerPromise) {
    networkVisualizerPromise = import('./visualization/NetworkVisualizer3D').then(({ NetworkVisualizer3D }) => {
      networkVisualizer = new NetworkVisualizer3D({
        container: visualizerContainerEl,
        detailTitleEl: vizDetailTitle,
        detailCopyEl: vizDetailCopy,
        metricsEl: vizMetrics,
        stagePillEl: vizStagePill,
        stageLineEl: vizStageLine,
        phaseEls: {
          preprocess: vizPhasePreprocess,
          cnn: vizPhaseCnn,
          activations: vizPhaseActivations,
          output: vizPhaseOutput,
        },
        nodeEls: {
          input: vizNodeInput,
          preprocess: vizNodePreprocess,
          conv: vizNodeConv,
          pool: vizNodePool,
          flatten: vizNodeFlatten,
          dense: vizNodeDense,
          output: vizNodeOutput,
        },
      });

      return networkVisualizer;
    });
  }

  return networkVisualizerPromise;
}

function setExperienceMode(analysisReady: boolean): void {
  appShell.classList.toggle('is-idle', !analysisReady);
  appShell.classList.toggle('analysis-ready', analysisReady);
}

async function transitionCanvasIntoAnalysis(): Promise<void> {
  if (appShell.classList.contains('analysis-ready')) {
    return;
  }

  if (flightAnimationPromise) {
    return flightAnimationPromise;
  }

  const startRect = drawCanvasElement.getBoundingClientRect();
  drawImageToCanvasFlight();
  drawCanvasElement.classList.add('is-hidden-for-flight');
  drawStage.classList.add('is-transitioning');
  canvasFlight.hidden = false;

  flightAnimationPromise = (async () => {
    setExperienceMode(true);
    await waitForNextPaint();

    const targetRect = drawCanvasElement.getBoundingClientRect();
    canvasFlightCanvas.style.left = `${targetRect.left}px`;
    canvasFlightCanvas.style.top = `${targetRect.top}px`;
    canvasFlightCanvas.style.width = `${targetRect.width}px`;
    canvasFlightCanvas.style.height = `${targetRect.height}px`;
    canvasFlightCanvas.style.transformOrigin = 'top left';

    const deltaX = startRect.left - targetRect.left;
    const deltaY = startRect.top - targetRect.top;
    const scaleX = startRect.width / Math.max(targetRect.width, 1);
    const scaleY = startRect.height / Math.max(targetRect.height, 1);

    const animation = canvasFlightCanvas.animate(
      [
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY}) rotate(0deg)`,
          opacity: 1,
          filter: 'drop-shadow(0 36px 72px rgba(0, 0, 0, 0.42))',
        },
        {
          transform: 'translate(0px, 0px) scale(1, 1) rotate(-1.4deg)',
          opacity: 1,
          filter: 'drop-shadow(0 28px 64px rgba(86, 183, 255, 0.22))',
        },
      ],
      {
        duration: 760,
        easing: 'cubic-bezier(0.2, 0.92, 0.2, 1)',
        fill: 'forwards',
      },
    );

    try {
      await animation.finished;
    } catch {
      // Ignore aborted animations and continue cleanup.
    } finally {
      animation.cancel();
      canvasFlight.hidden = true;
      canvasFlightCanvas.style.removeProperty('left');
      canvasFlightCanvas.style.removeProperty('top');
      canvasFlightCanvas.style.removeProperty('width');
      canvasFlightCanvas.style.removeProperty('height');
      canvasFlightCanvas.style.removeProperty('transform');
      canvasFlightCanvas.style.removeProperty('filter');
      canvasFlightCanvas.style.removeProperty('opacity');
      drawCanvasElement.classList.remove('is-hidden-for-flight');
      drawStage.classList.remove('is-transitioning');
      flightAnimationPromise = null;
    }
  })();

  return flightAnimationPromise;
}

function drawImageToCanvasFlight(): void {
  canvasFlightContext.clearRect(0, 0, canvasFlightCanvas.width, canvasFlightCanvas.height);
  canvasFlightContext.fillStyle = '#ffffff';
  canvasFlightContext.fillRect(0, 0, canvasFlightCanvas.width, canvasFlightCanvas.height);
  canvasFlightContext.drawImage(drawCanvasElement, 0, 0, canvasFlightCanvas.width, canvasFlightCanvas.height);
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function updatePrimaryActionState(): void {
  predictBtn.disabled = isAnalyzing || !modelReady || !hasStroke;
  clearBtn.disabled = isAnalyzing;
}

function renderCanvasGuidance(variant: 'idle' | 'ready' | 'warning' = hasStroke ? 'ready' : 'idle'): void {
  window.clearTimeout(guidanceResetTimeout);

  drawStage.classList.toggle('has-ink', hasStroke);
  drawStage.classList.toggle('needs-ink', variant === 'warning');
  drawHelper.classList.toggle('is-warning', variant === 'warning');

  if (variant === 'warning') {
    drawStatePill.dataset.state = 'warning';
    drawStatePill.textContent = 'Falta un trazo';
    drawHelper.textContent = 'Dibuja un numero en el canvas antes de iniciar el analisis.';
    updatePrimaryActionState();
    guidanceResetTimeout = window.setTimeout(() => {
      renderCanvasGuidance();
    }, 1800);
    return;
  }

  if (hasStroke) {
    drawStatePill.dataset.state = 'ready';
    drawStatePill.textContent = 'Trazo listo';
  } else {
    drawStatePill.dataset.state = 'idle';
    drawStatePill.textContent = 'Esperando trazo';
  }

  if (!hasStroke) {
    drawHelper.textContent = 'Dibuja un numero para activar el analisis.';
  } else if (!modelReady && modelError) {
    drawHelper.textContent = 'Tu trazo esta listo, pero el modelo no esta disponible todavia.';
  } else if (!modelReady) {
    drawHelper.textContent = 'Tu trazo esta listo. En cuanto el modelo termine de cargar podremos analizarlo.';
  } else {
    drawHelper.textContent = 'Todo listo. Pulsa el boton principal para recorrer la red paso a paso.';
  }

  updatePrimaryActionState();
}

function setModelState(loading: boolean, errorMessage: string | null): void {
  modelError = errorMessage;
  modelReady = !loading && !errorMessage;

  if (loading) {
    modelStatusEl.textContent = 'Cargando modelo...';
    modelStatusEl.className = 'pill loading';
    modelErrorEl.hidden = true;
    retryModelBtn.hidden = true;
    renderCanvasGuidance();
    return;
  }

  if (errorMessage) {
    modelStatusEl.textContent = 'Modelo no disponible';
    modelStatusEl.className = 'pill error';
    modelErrorEl.hidden = false;
    modelErrorEl.textContent = errorMessage;
    retryModelBtn.hidden = false;
    renderCanvasGuidance();
    return;
  }

  modelStatusEl.textContent = 'Modelo listo';
  modelStatusEl.className = 'pill ok';
  modelErrorEl.hidden = true;
  retryModelBtn.hidden = true;
  renderCanvasGuidance();
}

async function initModel(forceReload = false): Promise<void> {
  setModelState(true, null);

  try {
    await loadModel(forceReload);
    setModelState(false, null);
    scheduleVisualizerWarmup();
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message}. Verifica public/model/model.json y shards.`
        : 'No se pudo cargar el modelo.';

    setModelState(false, message);
  }
}

function scheduleVisualizerWarmup(): void {
  const warm = () => {
    void ensureNetworkVisualizer();
  };
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void) => number;
  };

  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(() => {
      warm();
    });
    return;
  }

  globalThis.setTimeout(warm, 250);
}

predictBtn.addEventListener('click', async () => {
  hasStroke = drawCanvas.hasStroke();
  if (!hasStroke) {
    renderCanvasGuidance('warning');
    return;
  }

  if (!modelReady) {
    setModelState(false, modelError ?? 'Modelo no disponible. Intenta recargar.');
    return;
  }

  predictBtn.disabled = true;
  clearBtn.disabled = true;
  predictBtn.textContent = 'Analizando...';
  replayBtn.disabled = true;
  isAnalyzing = true;
  renderCanvasGuidance('ready');

  try {
    const imageData = drawCanvas.exportImageData();
    const matrix = preprocessTo28x28(imageData);
    pixelGrid.update(matrix);
    const transitionPromise = transitionCanvasIntoAnalysis();

    const model = await loadModel();
    const result = await predictDigitDetailed(model, matrix);
    const visualizer = await ensureNetworkVisualizer();
    await transitionPromise;

    predictionPanel.render(result.prediction);
    visualizer.update(result, imageData);
    lastAnalysis = { result, imageData };
    replayBtn.hidden = false;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown prediction error';
    setModelState(false, message);
    if (!lastAnalysis) {
      setExperienceMode(false);
    }
  } finally {
    predictBtn.textContent = 'Ver como lo interpreta';
    replayBtn.disabled = false;
    isAnalyzing = false;
    updatePrimaryActionState();
  }
});

clearBtn.addEventListener('click', () => {
  drawCanvas.clear();
  pixelGrid.clear();
  predictionPanel.reset();
  networkVisualizer?.clear();
  lastAnalysis = null;
  replayBtn.hidden = true;
  setExperienceMode(false);
  hasStroke = false;
  renderCanvasGuidance();
});

replayBtn.addEventListener('click', async () => {
  if (!lastAnalysis) {
    return;
  }

  replayBtn.disabled = true;

  try {
    const visualizer = await ensureNetworkVisualizer();
    setExperienceMode(true);
    visualizer.update(lastAnalysis.result, lastAnalysis.imageData);
  } finally {
    replayBtn.disabled = false;
  }
});

retryModelBtn.addEventListener('click', async () => {
  await initModel(true);
});

drawCanvas.setOnChangeListener((nextHasStroke) => {
  hasStroke = nextHasStroke;
  renderCanvasGuidance();
});

setExperienceMode(false);
renderCanvasGuidance();
void initModel();
