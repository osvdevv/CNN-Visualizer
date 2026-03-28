# CNN Visualizer - Model Integration Specification

## 1. Purpose

This document defines the technical integration contract between CNN Visualizer and the pre-trained MNIST TensorFlow.js model, including loading, preprocessing alignment, inference execution, intermediate activation extraction, and runtime safety.

## 2. Integration Requirements

1. Model must load from static assets only.
2. Inference must run entirely in-browser.
3. Input preprocessing must match model expectations exactly.
4. Intermediate layer outputs must be available for visualization.
5. Tensor memory lifecycle must remain bounded during repeated use.

## 3. Model Asset Layout

Expected production structure:

- `public/model/model.json`
- `public/model/group1-shard1of1.bin` (or equivalent shard set)

Load path contract:

```ts
const MODEL_URL = '/model/model.json';
const model = await tf.loadLayersModel(MODEL_URL);
```

## 4. Runtime Initialization

Initialization sequence:

1. Initialize TensorFlow.js backend.
2. Load base model from static path.
3. Build intermediate-output model once.
4. Warm up model with dummy input tensor.
5. Expose ready state to UI.

Reference pattern:

```ts
await tf.ready();
const model = await tf.loadLayersModel('/model/model.json');
const intermediateModel = tf.model({
  inputs: model.inputs,
  outputs: model.layers.map((l) => l.output),
});
tf.tidy(() => model.predict(tf.zeros([1, 28, 28, 1])));
```

## 5. Input Compatibility Contract

Model input requirements:

- Shape: `[1, 28, 28, 1]`
- Type: `float32`
- Value range: `[0,1]` (or consistently inverted if model expects it)

Validation checks before inference:

1. Tensor rank is `4`.
2. Spatial dimensions are exactly `28x28`.
3. Channel count is `1`.
4. No `NaN`/`Infinity` values.

## 6. Inference Execution Contract

For each predict request:

1. Build input tensor from preprocess output.
2. Run base model for final output.
3. Run intermediate model for layer outputs.
4. Materialize outputs for UI/rendering payload.
5. Dispose temporary tensors.

Output contract:

- `probabilities: number[10]`
- `topClass: number`
- `topConfidence: number`
- `activations: LayerActivationPayload[]`

## 7. Intermediate Model Strategy

The intermediate model must be created once and reused.

Rationale:

- avoids repeated graph construction,
- lowers runtime overhead,
- ensures stable layer ordering.

Layer metadata to capture:

- `index`
- `name`
- `className/type`
- `outputShape`

## 8. Memory Management Rules

Mandatory runtime rules:

1. Wrap inferencing blocks in `tf.tidy()` where possible.
2. Dispose non-retained tensors explicitly.
3. Convert retained tensors to typed arrays immediately.
4. Never recreate `model` or `intermediateModel` on each prediction.

Recommended helper:

```ts
function safeDispose(tensors: Array<tf.Tensor | null | undefined>) {
  for (const t of tensors) if (t) t.dispose();
}
```

## 9. Error Handling Contract

### Recoverable Errors

- Model asset fetch failure.
- Weight shard mismatch.
- Input shape mismatch.
- Backend initialization issues.

Required behavior:

1. Return structured error code and user-safe message.
2. Keep UI responsive.
3. Allow retry without full page reload when feasible.

### Structured Error Shape

```ts
type ModelError = {
  code: 'MODEL_LOAD_FAILED' | 'INVALID_INPUT_SHAPE' | 'INFERENCE_FAILED' | 'BACKEND_ERROR';
  message: string;
  cause?: unknown;
};
```

## 10. Determinism and Reproducibility

For identical processed input matrices:

1. Probability vector must remain stable within floating-point tolerance.
2. Top class should remain consistent.
3. Activation extraction order must not change between runs.

Recommended tolerance for numerical checks: `1e-5` to `1e-4`.

## 11. Performance Expectations

1. Model load occurs once per session.
2. Warm-up executed only during initialization.
3. Predict loop avoids unnecessary tensor copies.
4. Intermediate payload conversion should be bounded and incremental-friendly.

## 12. Integration Test Cases

Minimum required test set:

1. Model load success using local static assets.
2. Invalid model path returns `MODEL_LOAD_FAILED`.
3. Valid `28x28` input returns length-10 output vector.
4. Invalid input shape triggers validation error.
5. Intermediate activations exist for all configured layers.
6. Repeated inference loop does not leak memory over N iterations.

## 13. Security and Operational Notes

1. No user-generated data is sent to external inference APIs.
2. Static model assets should be versioned and integrity-checked in source control.
3. Avoid dynamic remote model URLs in production builds.

## 14. Why This Integration Design

This design is used because it provides:

1. deterministic local inference behavior,
2. strong compatibility guarantees between preprocess and model input,
3. explicit support for explainability through intermediate activations,
4. operational simplicity for static deployment environments.

