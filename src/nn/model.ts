import * as tf from '@tensorflow/tfjs';

let modelPromise: Promise<tf.LayersModel> | null = null;

export async function loadModel(forceReload = false): Promise<tf.LayersModel> {
  if (forceReload || !modelPromise) {
    modelPromise = tf.loadLayersModel('/model/model.json').then(async (model) => {
      // Warmup stabilizes first inference latency.
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
  }

  return modelPromise;
}
