# Python Training Workspace

This workspace trains the CNN in Python and exports browser-ready TensorFlow.js artifacts back into `public/model`.

## Why This Exists

- Python training is substantially faster and more flexible than the pure `@tensorflow/tfjs` Node path.
- The frontend still expects a TensorFlow.js `LayersModel`, so the Python flow exports weights first and then rebuilds the final TF.js model with the repo's Node exporter.

## Tooling Choice

The machine's system `python3` is `3.14`, which is too new for the TensorFlow wheel we want here. This workspace uses `uv` to provision Python `3.12` locally without touching the rest of your system.

## First-Time Setup

Install `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Create the managed Python environment and install dependencies:

```bash
cd training/python
uv python install 3.12
uv sync --python 3.12
```

## Train The CNN

Quick smoke test:

```bash
cd training/python
uv run --python 3.12 train_cnn.py --train-size 4000 --test-size 800 --epochs 1
```

Full run:

```bash
cd training/python
uv run --python 3.12 train_cnn.py --train-size 60000 --test-size 10000 --epochs 10
```

The script will:

1. Download MNIST through Keras if needed.
2. Train the CNN in Python with light canvas-style augmentation.
3. Save raw trained weights to `training/python/artifacts/cnn-weights.json`.
4. Call the repo's Node exporter and regenerate:
   - `public/model/model.json`
   - `public/model/group1-shard1of1.bin`

Each successful run overwrites the current files in `public/model`.

## Environment Variables

The script also accepts the same environment-style knobs used by the JS trainer:

- `MNIST_TRAIN_SIZE`
- `MNIST_TEST_SIZE`
- `EPOCHS`
- `BATCH_SIZE`
- `LEARNING_RATE`
- `VALIDATION_SPLIT`
- `EARLY_STOPPING_PATIENCE`
- `SEED`

Example:

```bash
cd training/python
MNIST_TRAIN_SIZE=8000 MNIST_TEST_SIZE=1600 EPOCHS=3 BATCH_SIZE=128 \
uv run --python 3.12 train_cnn.py
```

## Skip The Final TF.js Export

If you only want the Python weights JSON and summary:

```bash
cd training/python
uv run --python 3.12 train_cnn.py --skip-tfjs-export
```
