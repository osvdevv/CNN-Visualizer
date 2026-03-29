# Task Plan - `feature/model-improvement-and-cloudflare-deploy`

## Assigned to: osvdevv

## Branch Goal

Deliver Phase 2 of CNN Visualizer by improving model quality and production readiness:

1. Improve digit recognition quality versus the MVP baseline.
2. Add measurable evaluation metrics and acceptance thresholds.
3. Improve preprocessing and prediction UX for better real-world inputs.
4. Add CI/CD deployment with GitHub Actions to Cloudflare Pages.

## Expected Outcome (Definition of Done)

- Model quality improves on validation/test metrics (accuracy and confusion matrix reviewed).
- The app uses a trained TensorFlow.js model artifact (not random weights).
- Predictions are more stable for handwritten `0-9` across repeated attempts.
- UI includes clearer confidence feedback and error states for model/runtime issues.
- A GitHub Actions workflow builds and deploys automatically to Cloudflare Pages on `main`.
- Deployment secrets are documented and pipeline can be rerun safely.

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
    group1-shard*.bin
.github/
  workflows/
    deploy-cloudflare-pages.yml
scripts/
  validate-model-assets.mjs
docs/
  09-model-improvement-and-deploy.md
```

## Step-by-Step Plan (Recommended Order)

## 1) Baseline Evaluation Snapshot

Implement:

1. Capture current MVP behavior on a fixed test set of drawn digits.
2. Record top-1 accuracy and common confusion pairs (`3/5`, `4/9`, etc.).
3. Save baseline metrics in docs for before/after comparison.

Acceptance criterion:

- There is a documented baseline metric snapshot.

## 2) Improve Training Data Strategy

Implement:

1. Start from MNIST and add augmentation representative of canvas input:
   - random shift
   - light rotation
   - stroke thickness variation
   - mild noise
2. Ensure train/val/test split is deterministic.
3. Export final trained model in TensorFlow.js format.

Acceptance criterion:

- New model artifacts are generated with reproducible training settings.

## 3) Upgrade Model Architecture

Implement:

1. Replace weak baseline architecture with a compact CNN stack.
2. Add regularization and normalization where useful:
   - dropout
   - batch normalization
3. Tune learning rate and early stopping strategy.

Acceptance criterion:

- Validation accuracy improves meaningfully versus baseline.

## 4) Improve Preprocessing Robustness

Implement:

1. Revisit centering/scaling to preserve digit shape better.
2. Add optional denoising for accidental dots or tiny strokes.
3. Ensure intensity inversion and normalization match training pipeline exactly.

Acceptance criterion:

- Same user drawing style yields more consistent predictions.

## 5) Better Prediction UX

Implement:

1. Highlight top-3 classes, not only top-1.
2. Add confidence quality hints:
   - high confidence
   - medium confidence
   - low confidence / ambiguous
3. Add clear UI messaging when model load or inference fails.

Acceptance criterion:

- Users can interpret uncertain predictions without guessing.

## 6) Model Asset Validation Guard

Implement:

1. Add a script to validate `public/model/model.json` and shard existence.
2. Run this check in CI before deployment.

Suggested checks:

- Valid JSON parse
- `weightsManifest` exists
- Every shard path resolves on disk

Acceptance criterion:

- Invalid model assets fail fast in CI.

## 7) Cloudflare Pages Deployment via GitHub Actions

Implement:

1. Create workflow `.github/workflows/deploy-cloudflare-pages.yml`.
2. On push to `main`:
   - checkout
   - install dependencies
   - run `npm ci`
   - run `npm run build`
   - deploy `dist/` to Cloudflare Pages
3. Configure required GitHub secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

Required repository variables/secrets:

- `CLOUDFLARE_PROJECT_NAME` (repo variable or hardcoded in workflow)

Acceptance criterion:

- Push to `main` triggers successful build+deploy and updates Pages site.

## 8) Post-Deploy Verification

Checklist:

1. Confirm app loads from Cloudflare Pages URL.
2. Confirm model files are reachable in production:
   - `/model/model.json`
   - shard files from manifest
3. Draw `0`, `1`, `7`, `8`, `9` and verify coherent predictions.
4. Confirm retry/error UI works when model path is intentionally broken (staging test).

Acceptance criterion:

- Production app behaves like local build and serves model assets correctly.

## 9) Documentation and Handover

Implement:

1. Add `docs/09-model-improvement-and-deploy.md` with:
   - training decisions
   - metric results
   - deployment setup
   - rollback steps
2. Update README with quick deploy notes.

Acceptance criterion:

- Another developer can retrain and redeploy without tribal knowledge.

## 10) Recommended Commit Sequence

Suggested commits:

```text
feat(model): improve cnn architecture, training pipeline, and tfjs artifacts
feat(ui): add top-3 confidence feedback and stronger prediction states
ci(deploy): add cloudflare pages github action with model validation
docs: add phase-2 model improvement and deploy guide
```

## Common Risks and Quick Fixes

- Production can load app but not model:
  - verify `public/model` copied to build output and URL paths are absolute from site root.
- Better validation metric but poor real drawing accuracy:
  - align augmentation and preprocess exactly with browser canvas characteristics.
- CI deploy fails with auth error:
  - recheck Cloudflare token scopes and account id secret values.
- Large model slows first prediction:
  - keep architecture compact, run warmup once, and monitor bundle size.
