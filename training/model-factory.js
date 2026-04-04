function createCnnModel(tf) {
  const model = tf.sequential({ name: 'cnn_visualizer_cnn_v2' });
  addConvNormRelu(model, tf, 32, 'block1a', { inputShape: [28, 28, 1] });
  addConvNormRelu(model, tf, 32, 'block1b');
  model.add(tf.layers.maxPooling2d({ name: 'block1_pool', poolSize: 2, strides: 2 }));
  model.add(tf.layers.dropout({ name: 'block1_dropout', rate: 0.05 }));

  addConvNormRelu(model, tf, 64, 'block2a');
  addConvNormRelu(model, tf, 64, 'block2b');
  model.add(tf.layers.maxPooling2d({ name: 'block2_pool', poolSize: 2, strides: 2 }));
  model.add(tf.layers.dropout({ name: 'block2_dropout', rate: 0.1 }));

  model.add(tf.layers.flatten({ name: 'flatten' }));
  model.add(tf.layers.dense({ name: 'dense1', units: 128, useBias: false }));
  model.add(tf.layers.batchNormalization({ name: 'dense1_bn' }));
  model.add(tf.layers.reLU({ name: 'dense1_relu' }));
  model.add(tf.layers.dropout({ name: 'dense1_dropout', rate: 0.3 }));
  model.add(tf.layers.dense({ name: 'predictions', units: 10, activation: 'softmax' }));
  return model;
}

function addConvNormRelu(model, tf, filters, namePrefix, options = {}) {
  model.add(
    tf.layers.conv2d({
      name: `${namePrefix}_conv`,
      filters,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      ...options,
    }),
  );
  model.add(tf.layers.batchNormalization({ name: `${namePrefix}_bn` }));
  model.add(tf.layers.reLU({ name: `${namePrefix}_relu` }));
}

function createBaselineModel(tf) {
  const model = tf.sequential({ name: 'cnn_visualizer_baseline_v1' });
  model.add(tf.layers.flatten({ inputShape: [28, 28, 1] }));
  model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));
  return model;
}

module.exports = {
  createCnnModel,
  createBaselineModel,
};
