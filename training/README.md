# Training Workspace

This folder is isolated from the frontend runtime and is used only for model training experiments.

## Setup

```bash
cd training
npm install
```

This setup uses `@tensorflow/tfjs` (pure JS backend) so it works with modern Node versions on Windows without native build tools.

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

## Notes

- Baseline expected parameters: `28 * 28 * 10 + 10 = 7850`.
- CNN parameter count is printed by `model.countParams()` and `model.summary()`.
- Input convention is grayscale `[0, 1]` with background near `0` and ink near `1`.
- If you need native speed with `@tensorflow/tfjs-node`, use Node 20 LTS plus Visual Studio C++ Build Tools.
