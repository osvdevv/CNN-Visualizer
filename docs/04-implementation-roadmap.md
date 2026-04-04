# CNN Visualizer - Implementation Roadmap

## 1. Roadmap Goal

This roadmap reflects the sequence that matches the repository today:

1. establish a working browser inference baseline,
2. improve the model and the training/export workflow,
3. deploy the app to Cloudflare Pages through GitHub Actions,
4. return to the broader visualization vision afterward.

## 2. Status Snapshot

Current milestone status:

- Phase 1 - Browser Baseline: completed
- Phase 2 - Model Improvement + Training Pipeline: completed
- Phase 3 - Cloudflare Deploy: next
- Phase 4 - Advanced Visualization: future

## 3. Phase Plan

## Phase 1 - Browser Baseline

Status: completed

### Delivered

- `DrawCanvas` for digit input
- preprocessing to `28x28`
- `PixelGrid` preview
- browser model loading from `public/model`
- prediction UI with top class and all class confidences
- clear/reset and model retry flow

### Exit Criteria Met

1. User can draw and clear reliably.
2. Model loads in the browser.
3. Prediction returns a `10`-class confidence vector.
4. The baseline UI works on desktop and mobile layouts.

## Phase 2 - Model Improvement + Training Pipeline

Status: completed

### Delivered

- dedicated `training/` workspace
- baseline and CNN experiment scripts
- Python training workspace in `training/python/`
- `cnn-visualizer-cnn-v2`
- TensorFlow.js artifact export pipeline
- updated `public/model/model.json` and shard
- preprocessing alignment improvements in the browser

### Recorded Outcome

The committed training summary reports approximately:

- best validation accuracy: `0.9905`
- test accuracy: `0.9910`

### Exit Criteria Met

1. Model training is reproducible from repo docs.
2. Browser artifacts can be regenerated from the training flow.
3. The improved CNN is committed under `public/model/`.
4. Browser preprocessing is better aligned with real drawn digits.

## Phase 3 - Cloudflare Pages Deploy

Status: next

### Goal

Deploy the current static app to Cloudflare Pages through GitHub Actions.

### Planned Scope

- `.github/workflows/deploy-cloudflare-pages.yml`
- GitHub repository secrets for Cloudflare auth
- repository variable for the Pages project name
- build with `npm ci` and `npm run build`
- deploy `dist/` with `cloudflare/wrangler-action@v3`
- production verification that `/model/model.json` resolves correctly

### Exit Criteria

1. Push to `main` builds and deploys automatically.
2. The deployed site loads the model assets correctly.
3. Draw -> preprocess -> predict works in production.
4. The workflow can be rerun safely.

## Phase 4 - Advanced Visualization

Status: future

### Goal

Resume the original educational visualization track after deploy is stable.

### Candidate Scope

- intermediate activation extraction
- layer-by-layer explanation UI
- step/auto progression modes
- kernel traversal visualization
- richer rendering modules if the product still needs them

### Exit Criteria

1. Visualization features are built on top of the stable baseline.
2. Model/runtime correctness remains intact.
3. New rendering work does not regress deployability.

## 4. Workstream Breakdown

### Frontend Runtime

- drawing
- preprocessing
- prediction UX
- error states

### ML / Training

- baseline experiments
- CNN architecture iteration
- Python training
- TF.js export compatibility

### DevOps

- static build validation
- Cloudflare Pages workflow
- production asset verification

### Future Visualization

- activation extraction
- render payload design
- educational interaction model

## 5. Current Sequencing Logic

The repo now follows this dependency order:

1. stable browser baseline first,
2. stronger model second,
3. deployment third,
4. advanced visualization after the runtime and artifact pipeline are stable.

That order reduces the risk of building visualization complexity on top of unstable model or deployment behavior.

## 6. Main Risks

- Risk: deploy docs or workflow target the wrong platform.
  - Mitigation: keep deployment docs Cloudflare-only.
- Risk: model artifacts and browser topology drift apart.
  - Mitigation: regenerate through the shared export path.
- Risk: preprocess changes improve local examples but hurt production behavior.
  - Mitigation: validate with repeated handwritten digit checks.
- Risk: visualization work restarts before deploy is stable.
  - Mitigation: finish Cloudflare deployment first.

## 7. Release Gate For The Next Milestone

The next milestone is complete when:

1. Phase 3 deploy workflow exists,
2. Cloudflare production deploy succeeds,
3. model assets are reachable in production,
4. browser prediction behavior matches the local production build.
