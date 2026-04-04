# CNN Visualizer - Model Integration Specification

## 1. Purpose

This document defines the current integration contract between the frontend and the committed TensorFlow.js model artifacts.

It covers:

- where the model lives,
- how it is loaded,
- what input shape it expects,
- what output shape the UI expects,
- how the artifacts are regenerated from training.

## 2. Current Integration Requirements

1. The browser model must load from static assets only.
2. Inference must run entirely in-browser.
3. Frontend preprocessing must stay compatible with the trained model.
4. The exported model must produce a single `10`-class output tensor.
5. Temporary tensors must be disposed predictably.

## 3. Model Asset Layout

Current browser model files:

- `public/model/model.json`
- `public/model/group1-shard1of1.bin`

Current load contract:

```ts
const model = await tf.loadLayersModel('/model/model.json');
```

Important note:

- the app currently assumes hosting from a root-served static path,
- so deployment should preserve `/model/model.json` exactly as written.

## 4. Artifact Provenance

The committed browser artifacts are not hand-authored. They are regenerated from the training pipeline:

1. train the model in `training/python/train_cnn.py`,
2. write Python weights to `training/python/artifacts/cnn-weights.json`,
3. rebuild TF.js artifacts through `training/export-python-model.js`,
4. output the final browser artifacts into `public/model/`.

Current architecture identifier:

- `cnn-visualizer-cnn-v2`

## 5. Runtime Initialization

Current initialization sequence:

1. Call `loadModel()`.
2. Cache the resulting `Promise<tf.LayersModel>`.
3. Warm up the model once with zeros shaped `[1, 28, 28, 1]`.
4. Mark the UI as ready.

Reference pattern:

```ts
let modelPromise: Promise<tf.LayersModel> | null = null;

modelPromise = tf.loadLayersModel('/model/model.json').then(async (model) => {
  tf.tidy(() => {
    const warmupInput = tf.zeros([1, 28, 28, 1]);
    const warmupOutput = model.predict(warmupInput);
    if (Array.isArray(warmupOutput)) {
      warmupOutput.forEach((tensor) => tensor.dispose());
    } else {
      warmupOutput.dispose();
    }
  });

  await tf.nextFrame();
  return model;
});
```

## 6. Input Compatibility Contract

The current model expects:

- shape: `[1, 28, 28, 1]`
- dtype: `float32`
- value range: `[0,1]`

Frontend preprocessing must preserve:

1. centered digit placement,
2. grayscale intensity convention,
3. single-channel input,
4. compatibility with the improved CNN artifacts.

## 7. Inference Execution Contract

For each prediction request:

1. Flatten the `28x28` matrix into a `Float32Array`.
2. Build a `tensor4d` with shape `[1, 28, 28, 1]`.
3. Call `model.predict(input)`.
4. Ensure the result is a single tensor.
5. Interpret output as probabilities, or apply `softmax` if needed.
6. Copy values into JS arrays for the UI.

Current output contract:

```ts
type PredictionResult = {
  confidences: number[];
  topClass: number;
  topConfidence: number;
  ranking: Array<{ digit: number; confidence: number }>;
};
```

## 8. Error Handling

Current repo behavior includes:

- model-load error state in the UI,
- retry support for failed model loads,
- runtime guard if the model returns multiple outputs,
- runtime guard if the output length is not `10`.

Current limitation:

- the repo does not yet implement a formal structured error type shared across layers.

## 9. Memory Management Rules

Current required rules:

1. Warmup tensors must be disposed after initialization.
2. Prediction-time temporary tensors must stay inside `tf.tidy()`.
3. The copied output tensor must be disposed after reading values.
4. The model must be reused instead of reloaded for every prediction.

## 10. Operational Notes

- The frontend depends only on TF.js artifacts, not directly on the Python model.
- Exported artifacts must remain in source control if they are the production runtime model.
- Any topology change in training must still be export-compatible with the browser load path.

## 11. Current Non-Goals

The current integration contract does not yet require:

- intermediate activation extraction,
- layer-by-layer visualization payloads,
- dynamic remote model URLs,
- browser-side retraining.

Those are future capabilities, not part of the implemented model integration today.

## 12. Acceptance Checklist

The current model integration is valid when:

1. `loadModel()` succeeds from `/model/model.json`,
2. warmup runs without leaking obvious tensors,
3. valid `28x28` input returns `10` confidences,
4. prediction results render correctly in the UI,
5. regenerated artifacts from the training flow still load in the browser.
