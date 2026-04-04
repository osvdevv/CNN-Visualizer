# CNN Visualizer - Frontend Rendering Specification

## 1. Rendering Scope

This document describes the frontend rendering that exists today in the baseline app.

It covers:

- the drawing surface,
- the `28x28` preview grid,
- the prediction output panel,
- the current layout and visual system.

It does not describe future 3D visualization modules as if they already existed.

## 2. Current Rendering Goals

1. Make digit drawing feel immediate and reliable.
2. Show the processed model input clearly.
3. Present prediction results with minimal ambiguity.
4. Keep the UI stable across desktop and mobile widths.

## 3. Current Rendering Surfaces

### 3.1 Draw Surface

Implemented in `src/canvas/DrawCanvas.ts`.

Current behavior:

- internal resolution: `280x280`
- pointer-based drawing
- touch support through pointer events
- black stroke
- rounded line caps and joins
- default line width: `20`
- exported value: full-canvas `ImageData`

### 3.2 Model Input Preview

Implemented in `src/canvas/PixelGrid.ts`.

Current behavior:

- logical size: `28x28`
- displayed as a `140x140` canvas using `5px` blocks
- grayscale rendering:
  - higher ink values look darker,
  - background remains white
- cleared state is a white canvas

### 3.3 Prediction Panel

Implemented in `src/ui/PredictionPanel.ts`.

Current behavior:

- shows top predicted digit
- shows top confidence percentage
- renders a list of confidence bars for digits `0-9`
- resets to zeroed rows on clear

### 3.4 Status and Error Feedback

Implemented in `src/main.ts`.

Current behavior:

- loading pill while the model initializes
- success pill when the model is ready
- error pill and retry button when load fails

## 4. Layout Contract

The app currently renders:

1. a hero/header card,
2. a draw card,
3. a preview card,
4. a result card.

Desktop layout:

- three-column workspace grid:
  - draw,
  - preview,
  - prediction.

Mobile layout:

- cards stack into a single column below `980px`.

## 5. Visual System

Current visual language comes from `src/style.css`:

- warm neutral background gradients
- cream card surfaces
- orange accent color for primary actions and prediction emphasis
- `Space Grotesk` for main text
- `IBM Plex Mono` for technical labels and percentages

This is the actual visual system committed in the repo today.

## 6. Interaction Rules

- `Predict` must be a manual user action.
- `Clear` must wipe:
  - the draw canvas,
  - the `28x28` preview,
  - the prediction panel.
- `Retry model load` must only appear after a model-load failure.
- Disabling the predict button during inference is required to avoid overlapping requests.

## 7. Responsiveness Rules

- Canvas must remain readable and tappable on mobile.
- Preview and result cards must stack without clipping.
- Buttons must remain usable on narrow widths.
- Prediction bars must remain legible after wrap/stack transitions.

## 8. Performance Expectations

For the current baseline UI:

1. drawing should feel immediate,
2. preview rendering should update within the predict cycle,
3. repeated draw/predict/clear usage should not cause obvious degradation,
4. model warmup should happen once after load.

## 9. Current Frontend Module Contracts

- `DrawCanvas`
  - provides `clear()` and `exportImageData()`
- `preprocess.ts`
  - returns `Matrix28`
- `PixelGrid`
  - accepts `Matrix28`
- `PredictionPanel`
  - accepts `PredictionResult`
- `src/nn/model.ts`
  - returns a cached `LayersModel`
- `src/nn/predict.ts`
  - returns ranked confidences for `10` classes

## 10. Future Visualization Boundary

If advanced visualization is added later, it should be treated as a new rendering layer on top of the current baseline UI, not as something already present.

That future work may introduce:

- intermediate activation views,
- staged playback controls,
- richer rendering modules.

But those are not part of the current rendering contract.

## 11. Verification Checklist

1. Mouse and touch drawing both work.
2. The preview grid matches the processed input.
3. Top class and confidence bars update after prediction.
4. Loading and error states are visible and understandable.
5. The layout remains usable below `980px`.
