const fs = require('node:fs');
const path = require('node:path');
const tf = require('@tensorflow/tfjs');

async function saveModelArtifacts(model, targetDir = path.resolve(__dirname, '..', 'public', 'model')) {
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

module.exports = {
  saveModelArtifacts,
};
