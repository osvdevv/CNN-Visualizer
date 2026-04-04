const fs = require('node:fs');
const path = require('node:path');
const tf = require('@tensorflow/tfjs');
const { createCnnModel } = require('./model-factory');
const { saveModelArtifacts } = require('./tfjs-export');
const SUPPORTED_ARCHITECTURES = new Set([
  'cnn-visualizer-cnn-v1',
  'cnn-visualizer-cnn-v2',
]);

function parseArgs(argv) {
  const options = {
    weightsJson: path.resolve(__dirname, 'python', 'artifacts', 'cnn-weights.json'),
    outputDir: path.resolve(__dirname, '..', 'public', 'model'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--weights-json') {
      options.weightsJson = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--output-dir') {
      options.outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
  }

  return options;
}

function assertWeightShape(index, expectedShape, actualShape) {
  const expected = JSON.stringify(expectedShape);
  const actual = JSON.stringify(actualShape);

  if (expected !== actual) {
    throw new Error(
      `Shape incompatible en peso ${index}: esperado ${expected}, recibido ${actual}.`,
    );
  }
}

function getWeightRef(weight) {
  return weight.originalName || weight.name;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rawPayload = fs.readFileSync(options.weightsJson, 'utf8');
  const payload = JSON.parse(rawPayload);

  if (payload.format !== 'cnn-visualizer.keras-weights.v1') {
    throw new Error(`Formato de pesos no soportado: ${String(payload.format)}`);
  }

  if (!SUPPORTED_ARCHITECTURES.has(payload.architecture)) {
    throw new Error(`Arquitectura no soportada: ${String(payload.architecture)}`);
  }

  const model = createCnnModel(tf);
  const warmupOutput = tf.tidy(() => model.predict(tf.zeros([1, 28, 28, 1])));
  if (Array.isArray(warmupOutput)) {
    warmupOutput.forEach((tensor) => tensor.dispose());
  } else {
    warmupOutput.dispose();
  }

  const expectedWeights = model.weights.map((weight) => ({
    name: getWeightRef(weight),
    shape: weight.shape,
  }));

  if (!Array.isArray(payload.weights) || payload.weights.length !== expectedWeights.length) {
    throw new Error(
      `Numero de tensores incompatible: esperado ${expectedWeights.length}, recibido ${
        Array.isArray(payload.weights) ? payload.weights.length : 'valor invalido'
      }.`,
    );
  }

  const payloadWeightsByName =
    payload.weights.every((entry) => typeof entry.name === 'string' && entry.name.length > 0)
      ? new Map(payload.weights.map((entry) => [entry.name, entry]))
      : null;

  const tensors = expectedWeights.map((expectedWeight, index) => {
    const entry = payloadWeightsByName
      ? payloadWeightsByName.get(expectedWeight.name)
      : payload.weights[index];

    if (!entry) {
      throw new Error(`No se encontro el peso ${expectedWeight.name} en el JSON exportado.`);
    }

    assertWeightShape(index, expectedWeight.shape, entry.shape);
    return tf.tensor(entry.values, entry.shape, 'float32');
  });

  model.setWeights(tensors);
  await saveModelArtifacts(model, options.outputDir);

  console.log(`Modelo TF.js exportado a ${options.outputDir}`);
}

main().catch((error) => {
  console.error('Error al exportar pesos de Python a TF.js:', error);
  process.exitCode = 1;
});
