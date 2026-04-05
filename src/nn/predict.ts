import * as tf from '@tensorflow/tfjs';
import type { Matrix28 } from '../canvas/preprocess';

const INSPECTOR_LAYER_NAMES = [
  'block1b_relu',
  'block1_pool',
  'block2b_relu',
  'block2_pool',
  'flatten',
  'dense1_relu',
  'predictions',
] as const;

const inspectorCache = new WeakMap<tf.LayersModel, tf.LayersModel>();

export interface PredictionResult {
  confidences: number[];
  topClass: number;
  topConfidence: number;
  ranking: Array<{ digit: number; confidence: number }>;
}

export interface ActivationGrid {
  label: string;
  shape: [number, number, number];
  width: number;
  height: number;
  values: number[];
  mean: number;
  peak: number;
}

export interface ActivationVector {
  label: string;
  shape: [number];
  sourceLength: number;
  sampledLength: number;
  values: number[];
  mean: number;
  peak: number;
}

export interface VisualizationPayload {
  input: ActivationGrid & { nonZeroRatio: number };
  conv: [ActivationGrid, ActivationGrid];
  pooling: [ActivationGrid, ActivationGrid];
  flatten: ActivationVector;
  dense: ActivationVector;
  output: ActivationVector;
}

export interface DetailedPredictionResult {
  prediction: PredictionResult;
  visualization: VisualizationPayload;
}

export async function predictDigit(
  model: tf.LayersModel,
  matrix28: Matrix28,
): Promise<PredictionResult> {
  const detailed = await predictDigitDetailed(model, matrix28);
  return detailed.prediction;
}

export async function predictDigitDetailed(
  model: tf.LayersModel,
  matrix28: Matrix28,
): Promise<DetailedPredictionResult> {
  const inspector = getInspectorModel(model);
  const inputGrid = summarizeInputGrid(matrix28);
  const input = tf.tensor4d(matrixToFlatInput(matrix28), [1, 28, 28, 1], 'float32');
  const prediction = inspector.predict(input);

  if (!Array.isArray(prediction)) {
    input.dispose();
    throw new Error('Inspector model must return the configured intermediate outputs.');
  }

  try {
    const [
      block1Relu,
      block1Pool,
      block2Relu,
      block2Pool,
      flatten,
      dense,
      output,
    ] = prediction;

    const outputValues = Array.from(output.dataSync());
    const confidences = isProbabilityVector(outputValues)
      ? outputValues
      : readSoftmaxValues(output);

    return {
      prediction: buildPredictionResult(confidences),
      visualization: {
        input: inputGrid,
        conv: [
          summarizeFeatureGrid('Conv block 1', block1Relu),
          summarizeFeatureGrid('Conv block 2', block2Relu),
        ],
        pooling: [
          summarizeFeatureGrid('Pooling block 1', block1Pool),
          summarizeFeatureGrid('Pooling block 2', block2Pool),
        ],
        flatten: summarizeVector('Flatten projection', flatten, 72),
        dense: summarizeVector('Dense embedding', dense, 64),
        output: summarizeVector('Class confidences', output, 10, false),
      },
    };
  } finally {
    input.dispose();
    prediction.forEach((tensor) => tensor.dispose());
  }
}

function getInspectorModel(model: tf.LayersModel): tf.LayersModel {
  const cached = inspectorCache.get(model);
  if (cached) {
    return cached;
  }

  const outputs = INSPECTOR_LAYER_NAMES.map((layerName) => getSingleLayerOutput(model, layerName));
  const inspector = tf.model({
    inputs: model.inputs,
    outputs,
    name: `${model.name}_inspector`,
  });

  inspectorCache.set(model, inspector);
  return inspector;
}

function getSingleLayerOutput(model: tf.LayersModel, layerName: string): tf.SymbolicTensor {
  const layer = model.getLayer(layerName);
  const { output } = layer;

  if (Array.isArray(output)) {
    throw new Error(`Layer "${layerName}" exposes multiple outputs and cannot be visualized as a single tensor.`);
  }

  return output;
}

function summarizeInputGrid(matrix28: Matrix28): ActivationGrid & { nonZeroRatio: number } {
  const values = matrixToValues(matrix28);
  const nonZeroCells = values.filter((value) => value > 0.05).length;

  return {
    label: 'Model input',
    shape: [28, 28, 1],
    width: 28,
    height: 28,
    values,
    mean: average(values),
    peak: maxValue(values),
    nonZeroRatio: values.length === 0 ? 0 : nonZeroCells / values.length,
  };
}

function summarizeFeatureGrid(label: string, tensor: tf.Tensor): ActivationGrid {
  if (tensor.shape.length !== 4) {
    throw new Error(`Expected a 4D tensor for "${label}", got shape ${tensor.shape.join('x')}.`);
  }

  const [batch, height, width, channels] = tensor.shape;
  if (batch !== 1) {
    throw new Error(`Expected batch size 1 for "${label}", got ${batch}.`);
  }

  const source = tensor.dataSync();
  const aggregated = new Float32Array(height * width);

  for (let index = 0; index < aggregated.length; index += 1) {
    let sum = 0;
    const offset = index * channels;
    for (let channel = 0; channel < channels; channel += 1) {
      sum += source[offset + channel];
    }
    aggregated[index] = sum / channels;
  }

  const normalized = normalizeToUnit(aggregated);
  const values = Array.from(normalized);

  return {
    label,
    shape: [height, width, channels],
    width,
    height,
    values,
    mean: average(values),
    peak: maxValue(values),
  };
}

function summarizeVector(
  label: string,
  tensor: tf.Tensor,
  maxItems: number,
  normalize = true,
): ActivationVector {
  const values = Array.from(tensor.dataSync());
  const sourceLength = values.length;
  const normalized = normalize ? Array.from(normalizeToUnit(values)) : values;
  const sampled = sampleEvenly(normalized, maxItems);

  return {
    label,
    shape: [sourceLength],
    sourceLength,
    sampledLength: sampled.length,
    values: sampled,
    mean: average(normalized),
    peak: maxValue(normalized),
  };
}

function buildPredictionResult(confidences: number[]): PredictionResult {
  if (confidences.length !== 10) {
    throw new Error(`Expected 10 output classes, got ${confidences.length}.`);
  }

  const ranking = confidences
    .map((confidence, digit) => ({ digit, confidence }))
    .sort((a, b) => b.confidence - a.confidence);

  const top = ranking[0];

  return {
    confidences,
    topClass: top.digit,
    topConfidence: top.confidence,
    ranking,
  };
}

function readSoftmaxValues(tensor: tf.Tensor): number[] {
  const softmaxTensor = tf.softmax(tensor);

  try {
    return Array.from(softmaxTensor.dataSync());
  } finally {
    softmaxTensor.dispose();
  }
}

function matrixToFlatInput(matrix28: Matrix28): Float32Array {
  const flatInput = new Float32Array(28 * 28);
  let idx = 0;

  for (let y = 0; y < 28; y += 1) {
    for (let x = 0; x < 28; x += 1) {
      flatInput[idx] = matrix28[y][x];
      idx += 1;
    }
  }

  return flatInput;
}

function matrixToValues(matrix28: Matrix28): number[] {
  const values: number[] = [];

  for (let y = 0; y < 28; y += 1) {
    for (let x = 0; x < 28; x += 1) {
      values.push(matrix28[y][x]);
    }
  }

  return values;
}

function sampleEvenly(values: number[], maxItems: number): number[] {
  if (values.length <= maxItems) {
    return values;
  }

  const sampled: number[] = [];
  for (let index = 0; index < maxItems; index += 1) {
    const position = Math.floor((index * (values.length - 1)) / Math.max(maxItems - 1, 1));
    sampled.push(values[position]);
  }

  return sampled;
}

function normalizeToUnit(values: ArrayLike<number>): Float32Array {
  const normalized = new Float32Array(values.length);
  let peak = 0;

  for (let index = 0; index < values.length; index += 1) {
    peak = Math.max(peak, values[index]);
  }

  if (peak <= 0) {
    return normalized;
  }

  for (let index = 0; index < values.length; index += 1) {
    normalized[index] = values[index] / peak;
  }

  return normalized;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxValue(values: number[]): number {
  return values.reduce((peak, value) => Math.max(peak, value), 0);
}

function isProbabilityVector(values: number[]): boolean {
  const epsilon = 1e-3;
  const allInRange = values.every((v) => v >= -epsilon && v <= 1 + epsilon);
  const sum = values.reduce((acc, current) => acc + current, 0);

  return allInRange && Math.abs(sum - 1) < epsilon;
}
