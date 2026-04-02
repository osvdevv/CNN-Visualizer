const tf = require('@tensorflow/tfjs');
const mnist = require('mnist');
const fs = require('node:fs');
const path = require('node:path');

const TRAIN_SIZE = Number(process.env.MNIST_TRAIN_SIZE ?? 60000);
const TEST_SIZE = Number(process.env.MNIST_TEST_SIZE ?? 10000);
const EPOCHS = Number(process.env.EPOCHS ?? 10);
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 64);

function toTensor(data) {
  const inputs = data.map((item) => item.input);
  const outputs = data.map((item) => item.output);
  const sampleCount = inputs.length;

  return {
    xs: tf.tensor2d(inputs, [sampleCount, 28 * 28], 'float32').reshape([sampleCount, 28, 28, 1]),
    ys: tf.tensor2d(outputs, [sampleCount, 10], 'float32'),
  };
}

function metric(logs, modernKey, legacyKey) {
  if (typeof logs[modernKey] === 'number') {
    return logs[modernKey];
  }

  if (typeof logs[legacyKey] === 'number') {
    return logs[legacyKey];
  }

  return NaN;
}

async function saveModelArtifacts(model) {
  const targetDir = path.resolve(__dirname, '..', 'public', 'model');
  fs.mkdirSync(targetDir, { recursive: true });

  let capturedArtifacts = null;
  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      capturedArtifacts = artifacts;
      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
          modelTopologyBytes: JSON.stringify(artifacts.modelTopology).length,
          weightSpecsBytes: JSON.stringify(artifacts.weightSpecs).length,
          weightDataBytes: artifacts.weightData.byteLength,
        },
      };
    }),
  );

  if (!capturedArtifacts) {
    throw new Error('No se capturaron artefactos del modelo para exportacion.');
  }

  const modelJson = {
    modelTopology: capturedArtifacts.modelTopology,
    weightsManifest: [
      {
        paths: ['group1-shard1of1.bin'],
        weights: capturedArtifacts.weightSpecs,
      },
    ],
    format: 'layers-model',
    generatedBy: `TensorFlow.js tfjs-layers v${tf.version.tfjs}`,
    convertedBy: null,
  };

  fs.writeFileSync(
    path.join(targetDir, 'model.json'),
    `${JSON.stringify(modelJson, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(targetDir, 'group1-shard1of1.bin'),
    Buffer.from(capturedArtifacts.weightData),
  );
}

async function main() {
  console.log(`Cargando MNIST (${TRAIN_SIZE} train, ${TEST_SIZE} test)...`);
  const set = mnist.set(TRAIN_SIZE, TEST_SIZE);
  const trainData = set.training;
  const testData = set.test;

  const train = toTensor(trainData);
  const test = toTensor(testData);

  const model = tf.sequential();
  model.add(
    tf.layers.conv2d({
      inputShape: [28, 28, 1],
      filters: 32,
      kernelSize: 3,
      activation: 'relu',
      padding: 'same',
    }),
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

  model.add(
    tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: 'relu',
      padding: 'same',
    }),
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.5 }));
  model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));

  model.compile({
    optimizer: tf.train.adam(1e-3),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  const linearParamCount = 28 * 28 * 10 + 10;
  console.log(`Baseline lineal (Flatten+Dense) params: ${linearParamCount}`);
  console.log(`CNN params: ${model.countParams()}`);
  model.summary();

  console.log('Entrenando CNN...');
  await model.fit(train.xs, train.ys, {
    batchSize: BATCH_SIZE,
    epochs: EPOCHS,
    validationData: [test.xs, test.ys],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const loss = metric(logs, 'loss', 'loss');
        const acc = metric(logs, 'accuracy', 'acc');
        const valAcc = metric(logs, 'val_accuracy', 'val_acc');
        console.log(
          `Epoca ${epoch + 1}: loss=${loss.toFixed(4)} acc=${acc.toFixed(4)} val_acc=${valAcc.toFixed(4)}`,
        );
      },
    },
  });

  const evalResult = model.evaluate(test.xs, test.ys);
  const tensors = Array.isArray(evalResult) ? evalResult : [evalResult];
  const testAcc = tensors[1].dataSync()[0];
  console.log(`Precision en test: ${(testAcc * 100).toFixed(2)}%`);

  await saveModelArtifacts(model);
  console.log('Modelo guardado en ../public/model');

  tensors.forEach((tensor) => tensor.dispose());
  train.xs.dispose();
  train.ys.dispose();
  test.xs.dispose();
  test.ys.dispose();
}

main().catch((error) => {
  console.error('Error en entrenamiento CNN:', error);
  process.exitCode = 1;
});
