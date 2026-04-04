const tf = require('@tensorflow/tfjs');
const mnist = require('mnist');
const { createBaselineModel } = require('./model-factory');

const TRAIN_SIZE = Number(process.env.MNIST_TRAIN_SIZE ?? 10000);
const TEST_SIZE = Number(process.env.MNIST_TEST_SIZE ?? 2000);
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

async function main() {
  console.log(`Cargando MNIST baseline (${TRAIN_SIZE} train, ${TEST_SIZE} test)...`);
  const set = mnist.set(TRAIN_SIZE, TEST_SIZE);
  const trainData = set.training;
  const testData = set.test;

  const train = toTensor(trainData);
  const test = toTensor(testData);

  const modelBaseline = createBaselineModel(tf);
  modelBaseline.compile({
    optimizer: tf.train.adam(1e-3),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  console.log(`Baseline params: ${modelBaseline.countParams()}`);
  modelBaseline.summary();

  await modelBaseline.fit(train.xs, train.ys, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
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

  const evalRes = modelBaseline.evaluate(test.xs, test.ys);
  const tensors = Array.isArray(evalRes) ? evalRes : [evalRes];
  const testAcc = tensors[1].dataSync()[0];
  console.log(`Baseline test acc: ${(testAcc * 100).toFixed(2)}%`);

  tensors.forEach((tensor) => tensor.dispose());
  train.xs.dispose();
  train.ys.dispose();
  test.xs.dispose();
  test.ys.dispose();
}

main().catch((error) => {
  console.error('Error en baseline:', error);
  process.exitCode = 1;
});
