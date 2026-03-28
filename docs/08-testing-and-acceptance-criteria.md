# CNN Visualizer - Testing and Acceptance Criteria

## 1. Purpose

This document defines the quality strategy and release acceptance criteria for CNN Visualizer V1.

It establishes what must be validated before considering the product production-ready.

## 2. Test Strategy Overview

Testing is organized into four layers:

1. Unit tests for deterministic logic (preprocess, mapping, formatting).
2. Integration tests for module boundaries (canvas -> model -> visualization payload).
3. End-to-end tests for user workflows.
4. Manual exploratory checks for UX and visual quality.

## 3. Scope Under Test

### Functional Scope

- Drawing input and reset behavior.
- Preprocessing pipeline (`280x280` -> `28x28`).
- Model loading and inference execution.
- Intermediate activation extraction.
- Layer visualization and kernel animation.
- Step/auto playback controls.
- Output confidence bars and winner highlight.
- Responsive behavior on mobile/desktop.

### Non-Functional Scope

- Runtime stability across repeated runs.
- Memory safety in tensor lifecycle.
- Interactivity and perceived smoothness.
- Deployment correctness in production environment.

## 4. Unit Test Requirements

Minimum unit coverage areas:

1. Grayscale conversion and normalization math.
2. Bounding-box and centering logic.
3. Tensor shape builder for `[1,28,28,1]`.
4. Probability ranking and top-class selection.
5. Activation normalization for color mapping.

Expected characteristics:

- deterministic outputs for fixed inputs,
- clear edge-case handling (empty canvas, invalid values),
- no hidden side effects.

## 5. Integration Test Requirements

Critical integration paths:

1. `DrawCanvas -> preprocess -> tensor builder`.
2. `tensor input -> model.predict -> probability vector`.
3. `intermediateModel.predict -> activation payload builder`.
4. `orchestrator -> step panel + visualization + output bar synchronization`.

Pass condition:

- all connected modules exchange data in expected formats with stable ordering.

## 6. End-to-End Test Scenarios

### Scenario 1 - Basic Prediction Loop

1. Open app.
2. Draw a clear digit.
3. Observe confidence bars and top class.
4. Clear and redraw.

Expected result:

- no crash, output updates correctly after each draw.

### Scenario 2 - Step-by-Step Explanation

1. Draw digit.
2. Run `step` repeatedly.
3. Confirm stage progression order and UI text alignment.

Expected result:

- each step advances one logical stage and visualization remains synchronized.

### Scenario 3 - Auto Playback

1. Draw digit.
2. Run `auto`.
3. Adjust speed control during playback.

Expected result:

- timeline speed changes without desync or broken states.

### Scenario 4 - Mobile Usability

1. Open app on mobile viewport.
2. Draw digit, run inference, inspect output and stage controls.

Expected result:

- all key controls usable and content readable without clipping.

## 7. Acceptance Criteria (Functional)

V1 functional acceptance requires:

1. User can draw with mouse and touch.
2. Preprocess outputs valid `28x28` normalized matrix.
3. Model loads from static path and runs in browser.
4. Final output includes all `10` class confidences.
5. Intermediate activations are available for visualization.
6. Kernel animation and feature-map progression execute correctly.
7. Step and auto modes are both stable.
8. Reset behavior restores clean state for next run.

## 8. Acceptance Criteria (Non-Functional)

V1 non-functional acceptance requires:

1. No unbounded memory growth across repeated inference cycles.
2. No blocking/freezing during normal interaction flows.
3. Rendering remains visually coherent on desktop and mobile.
4. Production deployment works from default branch via CI.
5. No P0/P1 defects remain open at release gate.

## 9. Regression Checklist

Run before each release candidate:

1. Model asset path validity in production build.
2. Baseline prediction loop still operational.
3. Stage synchronization still correct after animation changes.
4. Output confidence formatting remains accurate.
5. Mobile layout still functional.

## 10. Defect Severity Policy

- P0: App unusable, crash, or major data-flow failure.
- P1: Core feature broken or incorrect inference/visualization behavior.
- P2: Secondary feature issue with workaround available.
- P3: Cosmetic or minor UX inconsistencies.

Release rule:

- P0/P1 must be resolved before production release.

## 11. Test Data and Reproducibility

Use a mixed test set:

1. Hand-drawn digits from multiple users.
2. Programmatically generated synthetic strokes.
3. Edge cases:
  - very thin strokes,
  - very thick strokes,
  - off-center digits,
  - near-empty canvas.

Store representative reference inputs and expected output ranges for regression validation.

## 12. CI Quality Gates

Recommended quality gates before deploy job:

1. Lint passes.
2. Unit/integration suite passes.
3. Production build succeeds.
4. Optional smoke E2E passes on preview build.

## 13. Release Sign-Off Template

A release is approved when:

1. Functional acceptance criteria: pass.
2. Non-functional acceptance criteria: pass.
3. Regression checklist: pass.
4. Open defect review completed.
5. Product owner/maintainer sign-off recorded.

## 14. Why This Testing Approach

This approach is selected because CNN Visualizer combines ML correctness, rendering synchronization, and interactive UX.

A layered strategy is required to:

1. catch deterministic logic issues early,
2. validate module contracts before full UI testing,
3. guarantee end-user workflow reliability before release.

