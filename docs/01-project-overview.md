# CNN Visualizer - Project Overview

## 1. Purpose

CNN Visualizer is a browser-native educational application that shows, in real time, how a convolutional neural network (CNN) processes a handwritten digit from input pixels to final prediction.

The product combines:

- Digit drawing and preprocessing on a 2D canvas.
- On-device inference using TensorFlow.js and a pre-trained MNIST model.
- Layer-by-layer 3D/animated visualization of activations and kernel traversal.
- Human-readable explanation of each stage in the inference pipeline.

The core intent is not only to classify digits, but to make the CNN decision process observable and understandable.

## 2. Product Goals

1. Enable users to draw any digit from 0-9 and receive immediate inference feedback.
2. Visualize intermediate CNN behavior step by step, not just final output.
3. Keep all computation client-side (no backend dependency).
4. Provide a technically accurate but intuitive learning experience for CNN fundamentals.
5. Ship as a lightweight static web app with straightforward deployment.

## 3. Scope (V1)

### In Scope

- Interactive drawing surface (mouse and touch).
- Downsampling and normalization from drawing resolution to 28x28 grayscale tensor.
- Loading a pre-trained MNIST TensorFlow.js model from static assets.
- Running inference and rendering:
  - top prediction,
  - confidence distribution across digits 0-9.
- Extraction and visualization of intermediate activations.
- Layer progression visualization:
  - Input,
  - Conv2D blocks,
  - MaxPooling,
  - Flatten,
  - Dense,
  - Output.
- Kernel traversal animation for convolution operations.
- Two execution modes:
  - step-by-step,
  - automatic playback with speed control.
- Responsive UI for desktop and mobile.
- Static deployment to GitHub Pages with CI-based publish flow.

### Out of Scope (V1)

- Model training or fine-tuning in the browser.
- Multi-dataset support beyond MNIST.
- User authentication, persistence, or cloud sync.
- Server-side inference APIs.
- Accessibility localization beyond base UI language.
- Advanced experiment tracking and analytics dashboards.

## 4. Target Users and Use Cases

### Target Users

- Students learning CNN fundamentals.
- Developers exploring TensorFlow.js inference internals.
- Educators demonstrating convolution and activation concepts live.

### Primary Use Cases

1. User draws a digit and observes end-to-end inference.
2. User inspects each layer activation to understand feature abstraction.
3. User toggles between manual step mode and automated animation.
4. User compares confidence changes after modifying the drawing.

## 5. High-Level User Flow

1. User opens the application.
2. User draws a digit on the canvas.
3. System preprocesses drawing into a normalized 28x28 input tensor.
4. System executes model inference and collects intermediate layer outputs.
5. UI renders:
   - input pixel grid,
   - layer-by-layer activation progression,
   - convolution kernel movement,
   - output confidence bars.
6. User replays stages, adjusts playback speed, or redraws input.

## 6. Functional Requirements

- FR-01: The app must allow freehand digit input with mouse and touch events.
- FR-02: The input pipeline must convert drawn data to 28x28 normalized grayscale values compatible with MNIST CNN input.
- FR-03: The model must load via `tf.loadLayersModel()` from local static files.
- FR-04: Inference must run entirely in-browser using TensorFlow.js.
- FR-05: The system must expose intermediate outputs for all relevant model layers.
- FR-06: The visualization engine must render per-layer activations with value-to-color mapping.
- FR-07: The UI must animate convolution kernel traversal and feature-map construction.
- FR-08: The app must provide both step mode and auto mode with adjustable speed.
- FR-09: The output panel must display confidence values for classes 0-9 and emphasize the winning class.
- FR-10: The app must support redraw/reset to restart inference cycles quickly.

## 7. Non-Functional Requirements

- NFR-01: No backend runtime dependency for inference or visualization.
- NFR-02: Smooth interaction on modern desktop and mobile browsers.
- NFR-03: Deterministic preprocessing and reproducible inference for identical input.
- NFR-04: Modular TypeScript codebase with clear separation between canvas, ML, visualization, and UI concerns.
- NFR-05: Build and deploy through Vite + GitHub Pages without custom infrastructure.
- NFR-06: Developer onboarding should be possible with standard Node.js tooling.

## 8. Technical Constraints and Assumptions

- The pre-trained MNIST model is distributed as TensorFlow.js artifacts (`model.json` + weight shard files) under `public/model/`.
- Visualization performance is bounded by browser GPU/CPU capabilities.
- The first release prioritizes conceptual clarity over maximal model complexity.
- Architecture must remain framework-light (Vanilla TypeScript + Vite) to preserve control and reduce overhead.

## 9. Success Criteria

The V1 delivery is successful when:

1. A user can draw digits and consistently receive valid model predictions.
2. Intermediate layer behavior is visible and synchronized with inference steps.
3. Kernel and activation animations are understandable and stable.
4. Output confidence UI reflects model outputs correctly in real time.
5. The app is deployable as a static site and runs without backend services.

## 10. Dependencies

- Runtime:
  - `@tensorflow/tfjs`
  - `three`
  - `gsap`
- Tooling:
  - `vite`
  - Node.js + npm
- Hosting:
  - GitHub Pages
  - GitHub Actions (deployment workflow)

## 11. Deliverable Definition for This Document

This document defines what must be built at the product level for CNN Visualizer V1.
Subsequent technical documents should elaborate implementation details for architecture, inference pipeline, rendering, roadmap, testing, and deployment.
