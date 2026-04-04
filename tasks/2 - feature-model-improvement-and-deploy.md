# Task Plan - `feature/model-improvement`

## Assigned to: @osvdevv

## Branch Goal

Capture only the model-improvement work completed in Phase 2:

1. Add a dedicated training workspace for baseline and CNN experiments.
2. Introduce a reproducible Python training flow with TensorFlow/Keras.
3. Upgrade the model architecture and export pipeline used by the frontend.
4. Align browser preprocessing more closely with the improved training setup.

## Expected Outcome (Definition of Done)

- A reusable training workspace exists under `training/` for baseline and CNN runs.
- A Python workspace exists under `training/python/` using `uv` + Python `3.12`.
- The project can train `cnn-visualizer-cnn-v2`, export weights, and regenerate TF.js artifacts.
- `public/model/model.json` and `public/model/group1-shard1of1.bin` correspond to the new CNN.
- Browser preprocessing is more robust for faint or slightly broken strokes.
- Training outputs include reproducible metrics and summary artifacts.

## Minimum File Structure

```text
src/
  canvas/
    preprocess.ts
training/
  README.md
  package.json
  train-baseline.js
  train-cnn.js
  model-factory.js
  tfjs-export.js
  export-python-model.js
  python/
    README.md
    pyproject.toml
    uv.lock
    train_cnn.py
    artifacts/
      cnn-weights.json
      training-summary.json
public/
  model/
    model.json
    group1-shard1of1.bin
```

## Implemented Scope

## 1) Training Workspace Setup

Implemented:

1. Added a dedicated `training/` workspace with its own `package.json`.
2. Added reusable scripts for:
   - `train:baseline`
   - `train:cnn`
   - `export:python-model`
3. Added a shared model factory and TF.js artifact exporter.

Acceptance delivered:

- Model experiments can be run without coupling training logic to the frontend app.

## 2) Baseline and CNN Experiment Scripts

Implemented:

1. Added `training/train-baseline.js` for the linear baseline.
2. Added `training/train-cnn.js` for a JS CNN training path.
3. Centralized architecture definitions in `training/model-factory.js`.

Acceptance delivered:

- The repo now has a baseline reference plus a CNN training path for comparison.

## 3) Python Training Workspace

Implemented:

1. Added `training/python/pyproject.toml` with TensorFlow and NumPy dependencies.
2. Added `training/python/uv.lock` and documented the `uv` workflow.
3. Added `training/python/train_cnn.py` with CLI flags and env-var overrides for:
   - dataset size
   - epochs
   - batch size
   - patience
   - validation split
   - learning rate
   - seed
4. Added export targets for:
   - `training/python/artifacts/cnn-weights.json`
   - `training/python/artifacts/training-summary.json`

Acceptance delivered:

- Training is reproducible and can be rerun locally with a managed Python toolchain.

## 4) Model Architecture Upgrade

Implemented:

1. Replaced the weaker baseline-style path with `cnn-visualizer-cnn-v2`.
2. Added a deeper CNN stack with:
   - two convolutional blocks
   - batch normalization
   - max pooling
   - dropout
   - dense head with regularization
3. Added training callbacks for:
   - early stopping
   - learning-rate reduction on plateau

Acceptance delivered:

- The repo now trains and exports a stronger CNN architecture than the MVP baseline.

## 5) Canvas-Style Data Augmentation

Implemented:

1. Added random translation, rotation, and zoom in the Python pipeline.
2. Added mild morphology variation to simulate thicker/thinner strokes.
3. Added light Gaussian noise and deterministic seed handling.

Acceptance delivered:

- The training pipeline better reflects real browser-drawn digits instead of clean MNIST only.

## 6) Browser Preprocessing Alignment

Implemented:

1. Updated `src/canvas/preprocess.ts` to apply light dilation before box detection.
2. Added an explicit ink threshold for bounding-box extraction.
3. Added optional debug output for the normalized `28x28` matrix.

Acceptance delivered:

- The browser input pipeline is less brittle for thin strokes and small gaps.

## 7) TF.js Export Pipeline and Artifacts

Implemented:

1. Added `training/export-python-model.js` to rebuild browser artifacts from Python weights.
2. Added `training/tfjs-export.js` to write `model.json` and shard binaries.
3. Regenerated:
   - `public/model/model.json`
   - `public/model/group1-shard1of1.bin`

Acceptance delivered:

- The frontend now consumes artifacts exported from the improved training flow.

## 8) Recorded Training Results

Current training summary artifact reports:

1. `best_val_accuracy`: `0.9905`
2. `test_accuracy`: `0.9910`
3. Focus digit accuracy:
   - `4`: `0.9817`
   - `7`: `0.9767`
   - `8`: `0.9938`
   - `9`: `0.9891`
4. Main confusion pairs observed:
   - `7 -> 2`
   - `4 -> 9`

Acceptance delivered:

- The branch includes measurable model-quality outputs instead of only ad hoc training runs.

## 9) Documentation Added

Implemented:

1. Added `training/README.md` to explain the training workspace.
2. Added `training/python/README.md` with setup, smoke test, and full-run instructions.

Acceptance delivered:

- Another developer can retrain the model and regenerate browser artifacts from repo docs.

## Recommended Commit History

Observed branch commits:

```text
80863fe Add training scripts and package configuration for CNN Visualizer
93c8626 model improvement
401189c feat: enhance CNN model architecture and training process
```

## Common Risks and Quick Fixes

- Python environment fails to install TensorFlow:
  - use the documented `uv` + Python `3.12` workflow instead of the system Python.
- Exported weights do not match the browser model:
  - regenerate artifacts through `training/export-python-model.js` so the TF.js topology and weights stay aligned.
- Browser predictions still look inconsistent:
  - recheck preprocess alignment and compare with the saved `training-summary.json` confusion pairs.
