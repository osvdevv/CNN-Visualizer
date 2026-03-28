# CNN Visualizer - Frontend Rendering Specification

## 1. Rendering Scope

This specification defines how frontend rendering must be implemented for CNN Visualizer V1 across:

- 2D drawing input (Canvas API),
- 3D layer visualization (Three.js),
- timeline animation orchestration (GSAP),
- activation shading (GLSL),
- responsive UI composition.

## 2. Rendering Goals

1. Preserve technical accuracy of CNN stage transitions.
2. Maintain smooth interaction in modern desktop/mobile browsers.
3. Keep animation and inference states synchronized.
4. Render activations in a visually interpretable way.

## 3. Rendering Subsystems

### 3.1 Draw Surface (2D Canvas)

- Resolution: `280x280` internal buffer.
- Input modalities: mouse + touch.
- Stroke behavior:
  - fixed or pressure-like radius (configurable),
  - anti-aliased brush,
  - high-contrast background/foreground.
- Export:
  - raw `ImageData`,
  - optional debug preview.

### 3.2 Input Pixel Grid

- Logical grid: `28x28`.
- Cell value source: normalized preprocess output.
- Color mapping:
  - low values -> near-black,
  - high values -> light/cyan-white range.

### 3.3 3D Activation Renderer (Three.js)

- Each layer represented as a structured geometry block/plane.
- Activation values mapped to material color and optional emissive intensity.
- Camera:
  - smooth pan between layers,
  - deterministic stage framing.

### 3.4 Kernel and Feature Map Animation (GSAP)

- Kernel traversal:
  - frame progression matching convolution sweep order,
  - highlighted `3x3` overlay region.
- Feature map progression:
  - value reveal synchronized with kernel movement,
  - stage-based delays for readability.

### 3.5 Shader Layer (GLSL)

- Vertex shader: geometry pass-through + optional intensity offset hooks.
- Fragment shader:
  - value-to-color transfer function,
  - glow accent for high activations.

## 4. Scene Composition Rules

1. Maintain one root Three.js scene and one active camera.
2. Group render objects by layer id for efficient hide/show updates.
3. Avoid full scene reconstruction on every inference.
4. Reuse geometries/materials when feasible.
5. Destroy/rebuild only payload-dependent meshes when input changes.

## 5. Color Mapping Specification

Activation color mapping must be deterministic and layer-local:

- Input: activation value `v`, layer min `min`, layer max `max`.
- Normalize: `n = (v - min) / (max - min + epsilon)`.
- Map:
  - `n=0` -> dark base,
  - mid-range -> cyan,
  - high-range -> near-white + optional glow.

Reference transfer function:

```ts
function mapActivationToColor(n: number): [number, number, number] {
  const t = clamp(n, 0, 1);
  const r = lerp(0.02, 0.85, t);
  const g = lerp(0.10, 0.95, t);
  const b = lerp(0.12, 1.00, t);
  return [r, g, b];
}
```

## 6. Animation Timeline Contract

All stage transitions must be orchestrated from a single timeline controller.

Required commands:

- `step()`
- `play()`
- `pause()`
- `setSpeed(multiplier)`
- `reset()`

Timeline responsibilities:

1. Trigger layer render transitions in sequence.
2. Trigger kernel traversal at convolution stages only.
3. Trigger UI stage text updates.
4. Trigger output bar reveal at final stage.

## 7. UI Layout and Responsiveness

### Desktop Layout

- Left: draw canvas + input grid.
- Center: 3D scene.
- Right: step panel + output bars.

### Mobile Layout

- Vertical stacking with prioritized ordering:
  1. draw canvas,
  2. prediction output,
  3. condensed visualization,
  4. collapsible step panel.

### Responsive Rules

- Minimum tap target size for controls.
- No clipped stage labels.
- Scene camera/framing recalculated on viewport changes.

## 8. Performance Budgets

Targets for interactive quality:

1. Input stroke feedback should feel immediate (<1 frame perceived lag on typical hardware).
2. Stage transitions should remain visually smooth under standard device load.
3. Inference + render update should not cause prolonged UI blocking.
4. Repeated draw/predict cycles should not show unbounded memory growth.

## 9. Frontend Module Contracts

- `DrawCanvas`
  - provides `getImageData()`, `clear()`, and draw event hooks.
- `PixelGrid`
  - accepts `28x28` normalized matrix.
- `LayerRenderer`
  - accepts structured activation payloads.
- `KernelAnim`
  - accepts convolution stage metadata + timing.
- `FeatureMap`
  - accepts per-position value stream.
- `StepPanel`
  - accepts stage metadata and active index.
- `OutputBar`
  - accepts class confidence vector (length `10`).

## 10. Error and Degradation Behavior

- If WebGL is unavailable:
  - fallback to simplified 2D activation representation.
- If device performance is low:
  - lower geometry density and disable expensive glow effects.
- If shader compile fails:
  - fallback to standard material without shader effects.

## 11. Verification Checklist

1. Canvas interaction works for mouse and touch.
2. `28x28` grid visually matches current drawing.
3. Layer visuals update correctly for each inference run.
4. Kernel animation path is accurate and repeatable.
5. Step/auto modes remain synchronized with stage UI.
6. Mobile layout remains usable and visually coherent.
7. No rendering artifacts after repeated resets.

## 12. Why This Rendering Design

This rendering design is selected because it provides a practical balance of:

1. pedagogical clarity (users can follow each CNN stage),
2. real-time performance (browser-native rendering stack),
3. maintainability (modular rendering contracts),
4. visual expressiveness (3D layers + shader-based activation encoding).

