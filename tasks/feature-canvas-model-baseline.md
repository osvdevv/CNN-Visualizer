# Task Plan - `feature/canvas-model-baseline`

## Branch Goal

Deliver Phase 1 of CNN Visualizer as a functional baseline:

1. Draw a digit on a canvas.
2. Convert it into a `28x28` model input.
3. Load the MNIST TensorFlow.js model.
4. Run inference.
5. Show prediction and `0-9` confidence scores.

## Expected Outcome (Definition of Done)

- You can draw with mouse and touch.
- The clear button resets canvas and prediction state.
- Preprocessing generates a reproducible normalized `28x28` matrix.
- The model loads from `public/model/model.json`.
- Inference runs in-browser and returns a 10-class vector.
- UI displays `topClass`, `topConfidence`, and confidence bars/list.
- No obvious memory leaks during repeated cycles (`tf.tidy`/`dispose` used properly).

## Minimum File Structure

```text
src/
  main.ts
  canvas/
    DrawCanvas.ts
    preprocess.ts
    PixelGrid.ts
  nn/
    model.ts
    predict.ts
  ui/
    PredictionPanel.ts
public/
  model/
    model.json
    group1-shard1of1.bin
```

## Step-by-Step Plan (Recommended Order)

## 1) Project Initialization

1. Create the project with Vite + TypeScript.
2. Install dependencies:
   - `@tensorflow/tfjs`
3. Start the dev server and verify it boots.

Commands:

```bash
npm create vite@latest cnn-visualizer -- --template vanilla-ts
cd cnn-visualizer
npm install
npm install @tensorflow/tfjs
npm run dev
```

## 2) Drawing Canvas (`DrawCanvas`)

Implement:

1. A `280x280` canvas.
2. Drawing events:
   - `pointerdown`
   - `pointermove`
   - `pointerup` / `pointerleave`
3. Touch support (covered by pointer events).
4. A `Clear` button.
5. A public method to export `ImageData`.

Acceptance criterion:

- Continuous drawing works smoothly and clears in one click.

## 3) Preprocess to `28x28` (`preprocess.ts`)

Implement the pipeline:

1. Read RGBA from `ImageData`.
2. Convert to grayscale.
3. Detect ink bounding box.
4. Re-center the digit in a square workspace.
5. Downsample to `28x28`.
6. Normalize to `[0,1]`.

Suggested functions:

- `toGrayscale(imageData)`
- `findInkBoundingBox(gray)`
- `centerAndResize(gray, 28, 28)`
- `normalize01(matrix)`

Acceptance criterion:

- Same drawing input => same `28x28` output matrix.

## 4) Input Visualization (`PixelGrid`)

Implement a simple `28x28` preview:

1. Render 784 cells (divs or canvas).
2. Map cell color intensity from normalized value.
3. Refresh whenever prediction is requested.

Acceptance criterion:

- The grid clearly reflects the processed digit.

## 5) Model Integration (`nn/model.ts`)

Implement:

1. `loadModel()` using `tf.loadLayersModel('/model/model.json')`.
2. Loading and error state handling.
3. Optional warmup with `tf.zeros([1,28,28,1])`.

Error handling:

- If model loading fails, show a UI error with retry option.

## 6) Prediction (`nn/predict.ts`)

Implement:

1. Convert `28x28` matrix to `[1,28,28,1]` tensor.
2. Run `model.predict`.
3. Apply `softmax` if output is not already probabilities.
4. Extract a JS array of 10 values.
5. Compute:
   - `topClass`
   - `topConfidence`
   - descending ranking

Important:

- Wrap inference work in `tf.tidy`.
- Explicitly `dispose` tensors when needed.

## 7) Result Panel (`PredictionPanel`)

Display:

1. Winning digit.
2. Main confidence percentage.
3. List or bars for digits `0-9`.

Acceptance criterion:

- Results update correctly after redraw + repredict.

## 8) Orchestration in `main.ts`

Wire together:

1. `DrawCanvas` -> preprocess -> `PixelGrid`
2. `PixelGrid` -> `predict`
3. `predict` -> `PredictionPanel`
4. `Clear` -> reset all state

Suggested control:

- Manual `Predict` button for this phase.

## 9) Quick Manual Validation

Checklist:

1. Draw `0`, `1`, `7`, `8`, `9`.
2. Verify top class changes coherently.
3. Run 30-50 cycles of draw/predict/clear.
4. Verify no freezes or visible degradation.

## 10) Recommended Commit

Suggested message:

```text
feat(canvas-model-baseline): implement draw, preprocess, mnist inference, and prediction UI
```

## Common Risks and Quick Fixes

- Model fails to load in deployment:
  - verify base path and files under `public/model`.
- Incoherent predictions:
  - verify intensity inversion in preprocess (`x` vs `1-x`).
- Memory leaks:
  - review `tf.tidy` scopes and retained tensors.
- Canvas looks correct but grid looks wrong:
  - review final normalization and downsampling.
