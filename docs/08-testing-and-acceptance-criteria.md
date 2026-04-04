# CNN Visualizer - Testing and Acceptance Criteria

## 1. Purpose

This document defines the quality strategy for the repository as it exists today:

- a working browser inference baseline,
- an improved model and training/export pipeline,
- an upcoming Cloudflare deployment milestone.

## 2. Current Testing Reality

The current repo relies mainly on:

- manual validation,
- build verification,
- inspection of generated training artifacts.

There is not yet a committed automated test suite or lint pipeline in the root project scripts, so the acceptance criteria below are written to match the actual stage of the codebase.

## 3. Scope Under Test

### Current Implemented Scope

- drawing input and reset behavior
- preprocessing pipeline (`280x280` -> `28x28`)
- model loading and warmup
- browser prediction flow
- top-class and confidence-bar rendering
- training artifact generation
- TF.js artifact regeneration

### Upcoming Scope

- Cloudflare Pages deployment through GitHub Actions

### Future Scope

- advanced visualization modules
- intermediate activation UI
- playback controls

## 4. Manual Runtime Checks

Minimum checks for the current browser app:

1. Open the app.
2. Confirm the model reaches the ready state.
3. Draw a clear `0`, `1`, `7`, `8`, and `9`.
4. Click `Predict` for each case.
5. Confirm:
   - the preview grid updates,
   - the top class updates,
   - the confidence bars update.
6. Click `Clear`.
7. Confirm canvas, preview, and prediction state reset.

## 5. Preprocessing Validation

The current preprocessing pipeline should be checked for:

1. deterministic output for repeated identical input,
2. resilience to thin strokes,
3. resilience to small gaps in a stroke,
4. sensible centering inside the `28x28` result,
5. non-crashing behavior for an empty canvas.

Current note:

- empty canvas currently becomes an all-zero matrix rather than a special no-input state.

## 6. Model Integration Validation

The current model integration passes when:

1. `loadModel()` succeeds from `/model/model.json`,
2. warmup finishes without user-visible errors,
3. prediction returns exactly `10` confidences,
4. the top class matches the highest-confidence output,
5. repeated predictions do not visibly degrade the app.

## 7. Training Pipeline Validation

The model-improvement phase passes when:

1. `training/python/train_cnn.py` runs from the documented `uv` workflow,
2. `training/python/artifacts/training-summary.json` is generated,
3. `training/python/artifacts/cnn-weights.json` is generated,
4. `training/export-python-model.js` regenerates `public/model/*`,
5. the regenerated browser artifacts still load in the frontend.

## 8. Recorded Quality Indicators

The current committed training summary reports approximately:

- best validation accuracy: `0.9905`
- test accuracy: `0.9910`

These values are not a substitute for browser validation, but they are part of the acceptance evidence for the Phase 2 model-improvement work.

## 9. Build Validation

Before any deploy work is considered ready:

1. run `npm ci`
2. run `npm run build`
3. confirm `dist/model/model.json` exists
4. confirm `dist/model/group1-shard1of1.bin` exists
5. open the local production preview if needed

## 10. Cloudflare Deploy Acceptance

For the upcoming deployment phase, acceptance requires:

1. GitHub Actions workflow exists,
2. workflow completes successfully on `main`,
3. Cloudflare serves the app without 404s for model assets,
4. draw -> predict works in production,
5. workflow rerun produces a safe redeploy.

## 11. Recommended Future Automated Coverage

When automated tests are added, prioritize:

1. grayscale conversion and normalization math,
2. bounding-box and centering logic,
3. tensor shape construction,
4. probability ranking logic,
5. model asset existence checks in production builds.

## 12. Defect Severity Policy

- P0: app unusable or production deploy broken
- P1: core prediction flow incorrect or unstable
- P2: secondary issue with workaround
- P3: cosmetic or low-impact UX issue

Release rule:

- P0 and P1 must be resolved before production rollout.

## 13. Current Release Gates

The current repo is ready for the next milestone only when:

1. browser baseline checks pass,
2. model artifacts are valid and load correctly,
3. training/export flow remains reproducible,
4. deployment docs and implementation agree on Cloudflare Pages.

## 14. Future Testing Boundary

When advanced visualization work begins, a separate acceptance layer should be added for:

- activation extraction,
- stage synchronization,
- visualization correctness,
- playback controls.

Those checks are intentionally not treated as current baseline acceptance criteria, because those features are not implemented yet.
