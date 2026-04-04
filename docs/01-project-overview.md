# CNN Visualizer - Project Overview

## 1. Purpose

CNN Visualizer is a browser-native application for drawing handwritten digits and running CNN inference fully in the browser.

At the current stage of the repository, the project includes:

- a working baseline frontend for draw -> preprocess -> predict,
- an improved CNN model exported as TensorFlow.js artifacts,
- a local training workspace for retraining and regenerating model assets,
- a planned next phase for Cloudflare Pages deployment through GitHub Actions.

## 2. Current Product State

The repo is no longer only a static prototype plan. It now has two implemented tracks:

1. Browser inference baseline:
   - draw on a `280x280` canvas,
   - preprocess to `28x28`,
   - load `public/model/model.json`,
   - run TensorFlow.js inference,
   - show top prediction and the confidence distribution for digits `0-9`.
2. Model-improvement workflow:
   - baseline and CNN experiments in `training/`,
   - reproducible Python training in `training/python/`,
   - export of trained weights back into `public/model/`.

## 3. Scope In Repo Today

### Implemented

- Freehand digit drawing with pointer events.
- Browser preprocessing aligned to the current model input expectations.
- `28x28` preview grid for the processed input.
- In-browser prediction using TensorFlow.js.
- Top-class and all-class confidence UI.
- Model loading, warmup, retry, and error messaging.
- Local training scripts for baseline and CNN experiments.
- Python `uv` workflow for training `cnn-visualizer-cnn-v2`.
- Export pipeline that regenerates browser-ready TF.js artifacts.

### Planned Next

- Cloudflare Pages deployment through GitHub Actions.
- Deployment secrets/variables documentation.
- Production verification for model asset paths and static hosting behavior.

### Explicitly Not Implemented Yet

- Layer-by-layer 3D visualization.
- Intermediate activation rendering in the UI.
- Kernel traversal animation.
- Step-by-step playback and auto-play timeline controls.
- Backend inference services.

## 4. Primary User Flows

### Browser User Flow

1. Open the application.
2. Draw a digit on the canvas.
3. Click `Predict`.
4. The app preprocesses the drawing to `28x28`.
5. The app runs the CNN in the browser.
6. The UI shows:
   - the processed input preview,
   - the top predicted digit,
   - confidence values for all `10` classes.

### Developer / Maintainer Flow

1. Retrain the model in `training/` or `training/python/`.
2. Regenerate `public/model/model.json` and shard files.
3. Validate local browser behavior against the updated artifacts.
4. Prepare the app for the next deployment phase in Cloudflare.

## 5. Functional Requirements

- FR-01: The app must allow freehand digit input with mouse and touch.
- FR-02: The browser pipeline must convert drawing data into a normalized `28x28` matrix.
- FR-03: The model must load from local static files under `public/model/`.
- FR-04: Inference must run entirely in-browser using TensorFlow.js.
- FR-05: The output UI must display the top class and all class confidences.
- FR-06: The repo must support retraining and TF.js artifact regeneration outside the browser runtime.
- FR-07: Updated model artifacts must remain compatible with the browser input pipeline.

## 6. Non-Functional Requirements

- NFR-01: No backend runtime dependency for inference.
- NFR-02: Repeated draw/predict/clear cycles must remain stable.
- NFR-03: Preprocessing must be deterministic for identical inputs.
- NFR-04: Training must be reproducible through documented local workflows.
- NFR-05: The app must remain deployable as a static site.
- NFR-06: Deployment docs must match the actual chosen hosting target.

## 7. Technical Stack

### Runtime

- TypeScript
- Vite
- `@tensorflow/tfjs`
- Canvas API

### Training

- Node.js scripts in `training/`
- Python `3.12` managed with `uv`
- TensorFlow / Keras
- NumPy

### Hosting Target

- Cloudflare Pages
- GitHub Actions

## 8. Model and Artifact Assumptions

- The browser model is served from:
  - `public/model/model.json`
  - `public/model/group1-shard1of1.bin`
- Current artifacts are produced from the improved `cnn-visualizer-cnn-v2` training flow.
- The browser runtime assumes the site can resolve `/model/model.json` from the site root.

## 9. Current Success Criteria

The current milestone is successful when:

1. A user can draw digits and receive stable browser predictions.
2. The preprocessed `28x28` preview reflects the drawn input.
3. The frontend loads the committed TF.js model artifacts without runtime errors.
4. Another developer can retrain the model and regenerate browser artifacts from repo docs.
5. The repository is ready for the next Cloudflare deployment phase.
