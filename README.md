# CNN Visualizer

CNN Visualizer is a browser-based handwritten digit recognizer built around a simple draw -> preprocess -> predict flow.

The project currently includes:

- a working frontend for drawing digits and running inference fully in the browser,
- an improved CNN model committed as TensorFlow.js artifacts under `public/model/`,
- a local training workspace for retraining and regenerating those artifacts,
- deployment documentation aimed at Cloudflare Pages as the next release step.

## Current Scope

Implemented today:

- freehand digit drawing on a `280x280` canvas,
- preprocessing to a normalized `28x28` input,
- TensorFlow.js inference in the browser,
- prediction UI with top class and full confidence distribution,
- model loading, warmup, retry, and error handling,
- reproducible training/export workflows in `training/` and `training/python/`.

Not implemented yet:

- layer-by-layer CNN visualization,
- activation map rendering,
- kernel traversal animation,
- step-by-step playback controls.

## Tech Stack

### Runtime

- TypeScript
- Vite
- `@tensorflow/tfjs`
- Canvas API

### Training

- Node.js training scripts in `training/`
- Python `3.12` with `uv` in `training/python/`
- TensorFlow / Keras
- NumPy

### Deployment Target

- Cloudflare Pages
- GitHub Actions

## Quick Start

Install dependencies and run the app locally:

```bash
npm install
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Preview the built app locally:

```bash
npm run preview
```

## Model Assets

The frontend loads the committed TensorFlow.js model from:

- `public/model/model.json`
- `public/model/group1-shard1of1.bin`

After a production build, Vite should copy these files to:

- `dist/model/model.json`
- `dist/model/group1-shard1of1.bin`

The browser runtime expects the model to be reachable from:

```text
/model/model.json
```

## Training Workflow

For model retraining, use the isolated training workspace.

Recommended path:

- [training/README.md](training/README.md)
- [training/python/README.md](training/python/README.md)

Fast Python setup:

```bash
cd training/python
uv python install 3.12
uv sync --python 3.12
uv run --python 3.12 train_cnn.py --train-size 4000 --test-size 800 --epochs 1
```

This flow exports browser-ready artifacts back into `public/model/`.

## Deployment Notes

The next deployment phase targets Cloudflare Pages through GitHub Actions.

When enabling the production deploy pipeline, the repository should define:

- GitHub secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- GitHub variable:
  - `CLOUDFLARE_PROJECT_NAME`

Expected production flow:

1. Push to `main`
2. Build with `npm ci` and `npm run build`
3. Deploy `dist/` to Cloudflare Pages
4. Verify `/model/model.json` and model shards load correctly

Redeploy / rollback flow:

1. Inspect the failed or previous GitHub Actions run
2. Verify Cloudflare credentials, account ID, and project name
3. Confirm `dist/model/` contains the model artifacts
4. Rerun the workflow or redeploy the last known good commit

More detail is documented in [docs/07-deployment-and-ci.md](docs/07-deployment-and-ci.md).

## Documentation

Detailed technical docs are available in `docs/`:

- [Project Overview](docs/01-project-overview.md)
- [System Architecture](docs/02-system-architecture.md)
- [CNN Inference Pipeline](docs/03-cnn-inference-pipeline.md)
- [Implementation Roadmap](docs/04-implementation-roadmap.md)
- [Frontend Rendering Spec](docs/05-frontend-rendering-spec.md)
- [Model Integration Spec](docs/06-model-integration-spec.md)
- [Deployment and CI](docs/07-deployment-and-ci.md)
- [Testing and Acceptance Criteria](docs/08-testing-and-acceptance-criteria.md)

## Project Status

Current milestone status:

- Phase 1 - Browser baseline: completed
- Phase 2 - Model improvement and training pipeline: completed
- Phase 3 - Cloudflare Pages deployment: next

## Authors

- Jose Manuel Cortes Ceron (`deepdevjose`)
- Luis Osvaldo Rufino Velazquez (`osvdevv`)

## License

MIT License. See [LICENSE](LICENSE).
