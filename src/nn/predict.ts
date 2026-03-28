import * as tf from '@tensorflow/tfjs';
import type { Matrix28 } from '../canvas/preprocess';

export interface PredictionResult {
  confidences: number[];
  topClass: number;
  topConfidence: number;
  ranking: Array<{ digit: number; confidence: number }>;
}

export async function predictDigit(
  model: tf.LayersModel,
  matrix28: Matrix28,
): Promise<PredictionResult> {
  const outputTensor = tf.tidy(() => {
    const flatInput = new Float32Array(28 * 28);
    let idx = 0;
    for (let y = 0; y < 28; y += 1) {
      for (let x = 0; x < 28; x += 1) {
        flatInput[idx] = matrix28[y][x];
        idx += 1;
      }
    }

    const input = tf.tensor4d(flatInput, [1, 28, 28, 1], 'float32');
    const prediction = model.predict(input);

    if (Array.isArray(prediction)) {
      throw new Error('Model returned multiple outputs; expected a single logits/probability tensor.');
    }

    const squeezed = prediction.squeeze();
    const values = Array.from(squeezed.dataSync());

    const maybeProbabilities = isProbabilityVector(values);
    const output = maybeProbabilities ? squeezed : tf.softmax(squeezed);

    return output.clone();
  });

  try {
    const confidences = Array.from(await outputTensor.data());

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
  } finally {
    outputTensor.dispose();
  }
}

function isProbabilityVector(values: number[]): boolean {
  const epsilon = 1e-3;
  const allInRange = values.every((v) => v >= -epsilon && v <= 1 + epsilon);
  const sum = values.reduce((acc, current) => acc + current, 0);

  return allInRange && Math.abs(sum - 1) < epsilon;
}
