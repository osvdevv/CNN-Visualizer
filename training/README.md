# Training Workspace

This folder is isolated from the frontend runtime and is used only for model training experiments.

## Recommended Path: Python

The fastest path for this repo is now the Python workspace in [python/README.md](python/README.md).

Why:

- TensorFlow/Keras in Python is faster than the pure JS backend used by the Node scripts here.
- The Python flow still exports a browser-ready TensorFlow.js model into `../public/model`.

Quick start:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
cd training/python
uv python install 3.12
uv sync --python 3.12
uv run --python 3.12 train_cnn.py --train-size 4000 --test-size 800 --epochs 1
```

## Setup

```bash
cd training
npm install
```

This setup uses `@tensorflow/tfjs` (pure JS backend) so it works with modern Node versions on Windows without native build tools.

The JS scripts are still useful as a fallback, but they are slower than the Python path above.

## Run Baseline (Flatten + Dense)

```bash
npm run train:baseline
```

Quick smoke test (fast run):

```bash
$env:MNIST_TRAIN_SIZE=2000; $env:MNIST_TEST_SIZE=400; $env:EPOCHS=1; npm run train:baseline
```

## Run CNN Training and Export

```bash
npm run train:cnn
```

Quick smoke test (fast run):

```bash
$env:MNIST_TRAIN_SIZE=4000; $env:MNIST_TEST_SIZE=800; $env:EPOCHS=1; npm run train:cnn
```

The CNN script saves a TensorFlow.js model to `../public/model`.

## Export A Python-Trained Model Manually

If you already have `training/python/artifacts/cnn-weights.json`, you can regenerate the browser model without retraining:

```bash
cd training
npm run export:python-model
```

## Notes

- Baseline expected parameters: `28 * 28 * 10 + 10 = 7850`.
- CNN parameter count is printed by `model.countParams()` and `model.summary()`.
- Input convention is grayscale `[0, 1]` with background near `0` and ink near `1`.
- If you need native speed with `@tensorflow/tfjs-node`, use Node 20 LTS plus Visual Studio C++ Build Tools.
