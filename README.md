# CNN Visualizer

Interactive browser-based visualization of how a Convolutional Neural Network (CNN) processes handwritten digits (MNIST) from input pixels to final prediction.

## What This Project Is

CNN Visualizer is a client-side educational app that lets users draw a digit (`0-9`) and inspect the full inference flow:

1. Input preprocessing (`280x280 -> 28x28`)
2. CNN layer progression (Conv, Pooling, Flatten, Dense)
3. Intermediate activations
4. Final class confidence distribution

The app is designed to run **100% in the browser** with no backend runtime.

## Tech Stack

- TypeScript (vanilla)
- Vite
- TensorFlow.js
- Three.js
- GSAP
- Canvas API

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

## Quick Start

```bash
npm create vite@latest cnn-visualizer -- --template vanilla-ts
cd cnn-visualizer
npm install
npm install @tensorflow/tfjs three gsap
npm run dev
```

## Model Assets

Place the TensorFlow.js model artifacts in:

- `public/model/model.json`
- `public/model/group1-shard1of1.bin` (or equivalent shard set)

## Project Status

Technical documentation is complete.
Implementation should follow the phased roadmap in `docs/04-implementation-roadmap.md`.

## Authors

- Jose Manuel Cortes Ceron (`deepdevjose`)
- Luis Osvaldo Rufino Velázquez (`osvdevv`)

## License

MIT License. See [LICENSE](LICENSE).
