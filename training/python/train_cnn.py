from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys
import time
from datetime import datetime, timezone

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import tensorflow as tf

MODEL_ARCHITECTURE = "cnn-visualizer-cnn-v2"
FOCUS_DIGITS = (4, 7, 8, 9)

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
TRAINING_DIR = SCRIPT_DIR.parent
REPO_ROOT = TRAINING_DIR.parent
ARTIFACTS_DIR = SCRIPT_DIR / "artifacts"
DEFAULT_WEIGHTS_JSON = ARTIFACTS_DIR / "cnn-weights.json"
DEFAULT_SUMMARY_JSON = ARTIFACTS_DIR / "training-summary.json"
DEFAULT_EXPORT_DIR = REPO_ROOT / "public" / "model"
NODE_EXPORT_SCRIPT = TRAINING_DIR / "export-python-model.js"


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value is not None else default


def env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    return float(value) if value is not None else default


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("Expected a positive integer.")
    return parsed


def ratio(value: str) -> float:
    parsed = float(value)
    if parsed <= 0 or parsed >= 1:
        raise argparse.ArgumentTypeError("Expected a float between 0 and 1.")
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the CNN Visualizer model in Python.")
    parser.add_argument("--train-size", type=positive_int, default=env_int("MNIST_TRAIN_SIZE", 60000))
    parser.add_argument("--test-size", type=positive_int, default=env_int("MNIST_TEST_SIZE", 10000))
    parser.add_argument("--epochs", type=positive_int, default=env_int("EPOCHS", 12))
    parser.add_argument("--batch-size", type=positive_int, default=env_int("BATCH_SIZE", 128))
    parser.add_argument("--patience", type=positive_int, default=env_int("EARLY_STOPPING_PATIENCE", 3))
    parser.add_argument("--seed", type=int, default=env_int("SEED", 42))
    parser.add_argument("--validation-split", type=ratio, default=env_float("VALIDATION_SPLIT", 0.1))
    parser.add_argument("--learning-rate", type=float, default=env_float("LEARNING_RATE", 7.5e-4))
    parser.add_argument("--weights-json", type=pathlib.Path, default=DEFAULT_WEIGHTS_JSON)
    parser.add_argument("--summary-json", type=pathlib.Path, default=DEFAULT_SUMMARY_JSON)
    parser.add_argument("--export-dir", type=pathlib.Path, default=DEFAULT_EXPORT_DIR)
    parser.add_argument("--skip-tfjs-export", action="store_true")
    parser.add_argument("--no-augment", action="store_true")
    return parser.parse_args()


def set_reproducible_seed(seed: int) -> None:
    np.random.seed(seed)
    tf.keras.utils.set_random_seed(seed)
    try:
        tf.config.experimental.enable_op_determinism()
    except Exception:
        pass


def limit_dataset(
    images: np.ndarray,
    labels: np.ndarray,
    requested_size: int,
    dataset_name: str,
) -> tuple[np.ndarray, np.ndarray]:
    available = images.shape[0]
    if requested_size > available:
        print(f"{dataset_name}: requested {requested_size}, using available {available}.")
        requested_size = available
    return images[:requested_size], labels[:requested_size]


def load_mnist(train_size: int, test_size: int, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    (x_train, y_train), (x_test, y_test) = tf.keras.datasets.mnist.load_data()
    x_train, y_train = limit_dataset(x_train, y_train, train_size, "Train split")
    x_test, y_test = limit_dataset(x_test, y_test, test_size, "Test split")

    x_train = x_train.astype("float32") / 255.0
    x_test = x_test.astype("float32") / 255.0
    x_train = np.expand_dims(x_train, axis=-1)
    x_test = np.expand_dims(x_test, axis=-1)

    rng = np.random.default_rng(seed)
    permutation = rng.permutation(x_train.shape[0])
    x_train = x_train[permutation]
    y_train = y_train[permutation]

    return x_train, y_train, x_test, y_test


class CanvasStyleAugmentation(tf.keras.layers.Layer):
    def __init__(self, seed: int = 42) -> None:
        super().__init__(name="canvas_style_augment")
        self.translate = tf.keras.layers.RandomTranslation(
            height_factor=0.12,
            width_factor=0.12,
            fill_mode="constant",
            fill_value=0.0,
            seed=seed,
        )
        self.rotate = tf.keras.layers.RandomRotation(
            factor=0.12,
            fill_mode="constant",
            fill_value=0.0,
            seed=seed + 1,
        )
        self.zoom = tf.keras.layers.RandomZoom(
            height_factor=(-0.18, 0.08),
            width_factor=(-0.18, 0.08),
            fill_mode="constant",
            fill_value=0.0,
            seed=seed + 2,
        )

    def call(self, inputs: tf.Tensor, training: bool = False) -> tf.Tensor:
        x = inputs
        if not training:
            return x

        x = self.translate(x, training=training)
        x = self.rotate(x, training=training)
        x = self.zoom(x, training=training)

        dilated = tf.nn.max_pool2d(x, ksize=3, strides=1, padding="SAME")
        eroded = -tf.nn.max_pool2d(-x, ksize=3, strides=1, padding="SAME")
        selector = tf.random.uniform([tf.shape(x)[0], 1, 1, 1], dtype=x.dtype)
        morphed = tf.where(selector < 0.35, dilated, tf.where(selector > 0.82, eroded, x))
        noise = tf.random.normal(tf.shape(morphed), stddev=0.02, dtype=morphed.dtype)
        return tf.clip_by_value(morphed + noise, 0.0, 1.0)

    def build(self, input_shape: tf.TensorShape) -> None:
        self.translate.build(input_shape)
        self.rotate.build(input_shape)
        self.zoom.build(input_shape)
        super().build(input_shape)


def conv_bn_relu(
    x: tf.Tensor,
    filters: int,
    name_prefix: str,
) -> tf.Tensor:
    x = tf.keras.layers.Conv2D(
        filters=filters,
        kernel_size=3,
        padding="same",
        use_bias=False,
        name=f"{name_prefix}_conv",
    )(x)
    x = tf.keras.layers.BatchNormalization(name=f"{name_prefix}_bn")(x)
    return tf.keras.layers.ReLU(name=f"{name_prefix}_relu")(x)


def create_core_model() -> tf.keras.Model:
    inputs = tf.keras.Input(shape=(28, 28, 1), name="image")
    x = conv_bn_relu(inputs, 32, "block1a")
    x = conv_bn_relu(x, 32, "block1b")
    x = tf.keras.layers.MaxPooling2D(pool_size=2, strides=2, name="block1_pool")(x)
    x = tf.keras.layers.Dropout(0.05, name="block1_dropout")(x)

    x = conv_bn_relu(x, 64, "block2a")
    x = conv_bn_relu(x, 64, "block2b")
    x = tf.keras.layers.MaxPooling2D(pool_size=2, strides=2, name="block2_pool")(x)
    x = tf.keras.layers.Dropout(0.1, name="block2_dropout")(x)

    x = tf.keras.layers.Flatten(name="flatten")(x)
    x = tf.keras.layers.Dense(128, use_bias=False, name="dense1")(x)
    x = tf.keras.layers.BatchNormalization(name="dense1_bn")(x)
    x = tf.keras.layers.ReLU(name="dense1_relu")(x)
    x = tf.keras.layers.Dropout(0.3, name="dense1_dropout")(x)
    outputs = tf.keras.layers.Dense(10, activation="softmax", name="predictions")(x)
    return tf.keras.Model(inputs=inputs, outputs=outputs, name="cnn_visualizer_cnn_v2")


def create_training_model(core_model: tf.keras.Model, use_augmentation: bool, seed: int) -> tf.keras.Model:
    inputs = tf.keras.Input(shape=(28, 28, 1), name="train_image")
    x = inputs
    if use_augmentation:
        x = CanvasStyleAugmentation(seed=seed)(x)
    outputs = core_model(x)
    return tf.keras.Model(inputs=inputs, outputs=outputs, name="cnn_visualizer_training_model")


def compile_classifier(model: tf.keras.Model, learning_rate: float) -> None:
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )


def compute_digit_metrics(true_labels: np.ndarray, predicted_labels: np.ndarray) -> dict[str, object]:
    confusion = tf.math.confusion_matrix(true_labels, predicted_labels, num_classes=10).numpy()
    per_digit_accuracy: dict[str, float] = {}
    per_digit_top_confusions: dict[str, list[dict[str, float | int]]] = {}

    for digit in range(10):
        row = confusion[digit]
        support = int(row.sum())
        correct = int(row[digit])
        accuracy = float(correct / support) if support else 0.0
        per_digit_accuracy[str(digit)] = accuracy

        row_without_self = row.copy()
        row_without_self[digit] = 0
        top_confusions: list[dict[str, float | int]] = []
        for predicted_digit in np.argsort(row_without_self)[::-1]:
            count = int(row_without_self[predicted_digit])
            if count == 0:
                continue
            top_confusions.append(
                {
                    "predicted_digit": int(predicted_digit),
                    "count": count,
                    "rate": float(count / support) if support else 0.0,
                }
            )
            if len(top_confusions) == 3:
                break
        per_digit_top_confusions[str(digit)] = top_confusions

    confusion_pairs: list[dict[str, float | int]] = []
    for actual_digit in range(10):
        support = int(confusion[actual_digit].sum())
        for predicted_digit in range(10):
            if actual_digit == predicted_digit:
                continue
            count = int(confusion[actual_digit, predicted_digit])
            if count == 0:
                continue
            confusion_pairs.append(
                {
                    "actual_digit": actual_digit,
                    "predicted_digit": predicted_digit,
                    "count": count,
                    "rate": float(count / support) if support else 0.0,
                }
            )

    confusion_pairs.sort(key=lambda item: (item["count"], item["rate"]), reverse=True)

    focus_digit_accuracy = {
        str(digit): per_digit_accuracy[str(digit)] for digit in FOCUS_DIGITS if str(digit) in per_digit_accuracy
    }

    return {
        "confusion_matrix": confusion.tolist(),
        "per_digit_accuracy": per_digit_accuracy,
        "per_digit_top_confusions": per_digit_top_confusions,
        "focus_digit_accuracy": focus_digit_accuracy,
        "top_confusion_pairs": confusion_pairs[:12],
    }


def print_focus_digit_report(metrics: dict[str, object]) -> None:
    per_digit_accuracy = metrics["per_digit_accuracy"]
    per_digit_top_confusions = metrics["per_digit_top_confusions"]
    print("Focus digits:")
    for digit in FOCUS_DIGITS:
        accuracy = float(per_digit_accuracy[str(digit)]) * 100
        confusions = per_digit_top_confusions[str(digit)]
        if confusions:
            top = confusions[0]
            print(
                f"  {digit}: {accuracy:.2f}% correct, most confused with "
                f"{top['predicted_digit']} ({float(top['rate']) * 100:.2f}%)"
            )
        else:
            print(f"  {digit}: {accuracy:.2f}% correct, no confusions recorded")


def save_weights_json(model: tf.keras.Model, weights_json: pathlib.Path, metadata: dict[str, object]) -> None:
    weights_json.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "format": "cnn-visualizer.keras-weights.v1",
        "architecture": MODEL_ARCHITECTURE,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "metadata": metadata,
        "weights": [],
    }

    for index, weight in enumerate(model.get_weights()):
        array = np.asarray(weight, dtype=np.float32)
        payload["weights"].append(
            {
                "index": index,
                "name": getattr(model.weights[index], "path", model.weights[index].name),
                "shape": list(array.shape),
                "dtype": "float32",
                "values": array.reshape(-1).tolist(),
            }
        )

    with weights_json.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, allow_nan=False, separators=(",", ":"))
        handle.write("\n")


def save_summary(summary_json: pathlib.Path, summary: dict[str, object]) -> None:
    summary_json.parent.mkdir(parents=True, exist_ok=True)
    with summary_json.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, allow_nan=False)
        handle.write("\n")


def export_tfjs(weights_json: pathlib.Path, output_dir: pathlib.Path) -> None:
    command = [
        "node",
        str(NODE_EXPORT_SCRIPT),
        "--weights-json",
        str(weights_json),
        "--output-dir",
        str(output_dir),
    ]
    subprocess.run(command, cwd=REPO_ROOT, check=True)


def main() -> int:
    args = parse_args()
    set_reproducible_seed(args.seed)

    print(f"TensorFlow: {tf.__version__}")
    print(f"Visible devices: {[device.name for device in tf.config.list_physical_devices()]}")
    print(f"Loading MNIST ({args.train_size} train, {args.test_size} test)...")

    x_train, y_train, x_test, y_test = load_mnist(args.train_size, args.test_size, args.seed)
    core_model = create_core_model()
    training_model = create_training_model(core_model, use_augmentation=not args.no_augment, seed=args.seed)
    compile_classifier(training_model, args.learning_rate)

    callbacks: list[tf.keras.callbacks.Callback] = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            mode="max",
            patience=args.patience,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_accuracy",
            mode="max",
            factor=0.5,
            patience=max(1, args.patience - 1),
            min_lr=1e-5,
        ),
    ]

    core_model.summary()
    started_at = time.perf_counter()
    history = training_model.fit(
        x_train,
        y_train,
        epochs=args.epochs,
        batch_size=args.batch_size,
        validation_split=args.validation_split,
        shuffle=True,
        callbacks=callbacks,
        verbose=2,
    )
    elapsed = time.perf_counter() - started_at

    compile_classifier(core_model, args.learning_rate)
    probabilities = core_model.predict(x_test, batch_size=args.batch_size, verbose=0)
    predicted_labels = np.argmax(probabilities, axis=1)
    test_loss, test_accuracy = core_model.evaluate(x_test, y_test, batch_size=args.batch_size, verbose=0)
    digit_metrics = compute_digit_metrics(y_test, predicted_labels)

    val_history = history.history.get("val_accuracy", [])
    train_history = history.history.get("accuracy", [])
    best_val_accuracy = max(val_history) if val_history else None
    final_train_accuracy = train_history[-1] if train_history else None

    summary = {
        "architecture": MODEL_ARCHITECTURE,
        "train_size": int(x_train.shape[0]),
        "test_size": int(x_test.shape[0]),
        "epochs_requested": args.epochs,
        "epochs_ran": len(history.history.get("loss", [])),
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "validation_split": args.validation_split,
        "augmentation_enabled": not args.no_augment,
        "seed": args.seed,
        "elapsed_seconds": round(elapsed, 3),
        "final_train_accuracy": final_train_accuracy,
        "best_val_accuracy": best_val_accuracy,
        "test_loss": float(test_loss),
        "test_accuracy": float(test_accuracy),
        "history": history.history,
        **digit_metrics,
    }

    print(f"Training finished in {elapsed:.2f}s")
    print(f"Test accuracy: {test_accuracy * 100:.2f}%")
    print_focus_digit_report(digit_metrics)

    save_weights_json(core_model, args.weights_json, summary)
    save_summary(args.summary_json, summary)
    print(f"Saved Python weights to {args.weights_json}")
    print(f"Saved training summary to {args.summary_json}")

    if not args.skip_tfjs_export:
        print("Exporting TensorFlow.js artifacts...")
        export_tfjs(args.weights_json, args.export_dir)
        print(f"Saved TensorFlow.js model to {args.export_dir}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as error:
        print(f"TF.js export failed with exit code {error.returncode}.", file=sys.stderr)
        raise SystemExit(error.returncode) from error
