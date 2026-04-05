import * as THREE from 'three';
import type { DetailedPredictionResult } from '../nn/predict';

type VisualizerPhase = 'preprocess' | 'cnn' | 'activations' | 'output';
type VisualizerNode = 'input' | 'preprocess' | 'conv' | 'pool' | 'flatten' | 'dense' | 'output';
type HeatmapPalette = 'preprocess' | 'conv' | 'pool';

interface VisualizerElements {
  container: HTMLElement;
  detailTitleEl: HTMLElement;
  detailCopyEl: HTMLElement;
  metricsEl: HTMLElement;
  stagePillEl: HTMLElement;
  stageLineEl: HTMLElement;
  phaseEls: Record<VisualizerPhase, HTMLElement>;
  nodeEls: Record<VisualizerNode, HTMLElement>;
}

interface HeatmapSurface {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  material: THREE.MeshStandardMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  basePosition: THREE.Vector3;
  size: number;
  palette?: HeatmapPalette;
}

interface BarField {
  group: THREE.Group;
  bars: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>;
  materials: THREE.MeshStandardMaterial[];
  values: number[];
  basePosition: THREE.Vector3;
  maxHeight: number;
  colors: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation];
}

interface Connector {
  id: string;
  from: VisualizerNode;
  to: VisualizerNode;
  curve: THREE.CatmullRomCurve3;
  material: THREE.LineBasicMaterial;
}

interface PhaseState {
  phase: VisualizerPhase;
  dominantNode: VisualizerNode;
  visitedNodeCount: number;
  pulseConnectorId: string | null;
  pulsePoint: THREE.Vector3;
  phaseProgress: number;
  globalProgress: number;
}

interface SweepBeam {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  span: number;
}

interface PoolFrame {
  mesh: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  material: THREE.LineBasicMaterial;
  span: number;
}

interface KernelFrame {
  mesh: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  material: THREE.LineBasicMaterial;
  span: number;
}

interface StreamParticle {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  offset: number;
}

interface CameraPose {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

const PHASE_DURATION = {
  preprocess: 2.1,
  cnn: 3.6,
  activations: 2.8,
  output: 2.2,
} as const;

const TOTAL_DURATION =
  PHASE_DURATION.preprocess +
  PHASE_DURATION.cnn +
  PHASE_DURATION.activations +
  PHASE_DURATION.output;

const NODE_ORDER: VisualizerNode[] = ['input', 'preprocess', 'conv', 'pool', 'flatten', 'dense', 'output'];
export class NetworkVisualizer3D {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  private readonly cameraLookTarget = new THREE.Vector3(5, -0.5, 0);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly resizeObserver: ResizeObserver;
  private readonly nodeMaterials = new Map<VisualizerNode, THREE.MeshStandardMaterial[]>();
  private readonly nodeAnchors = new Map<VisualizerNode, THREE.Vector3>();
  private readonly connectors = new Map<string, Connector>();
  private readonly floatingObjects: Array<{
    object: THREE.Object3D;
    basePosition: THREE.Vector3;
    amplitude: number;
    speed: number;
    phase: number;
  }> = [];
  private readonly rawSurface: HeatmapSurface;
  private readonly processedSurface: HeatmapSurface;
  private readonly convSurfaces: [HeatmapSurface, HeatmapSurface];
  private readonly poolSurfaces: [HeatmapSurface, HeatmapSurface];
  private readonly flattenBars: BarField;
  private readonly denseBars: BarField;
  private readonly outputBars: BarField;
  private readonly pulse: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly inputBeam: SweepBeam;
  private readonly preprocessBeam: SweepBeam;
  private readonly convBeams: [SweepBeam, SweepBeam];
  private readonly convKernels: [KernelFrame, KernelFrame];
  private readonly poolFrames: [PoolFrame, PoolFrame];
  private readonly flattenStreamCurve: THREE.CatmullRomCurve3;
  private readonly flattenStreamLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly flattenStreamParticles: StreamParticle[];
  private readonly outputHalo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  private readonly elements: VisualizerElements;
  private payload: DetailedPredictionResult | null = null;
  private playbackStart = 0;
  private currentPhase: VisualizerPhase | null = null;

  constructor(elements: VisualizerElements) {
    this.elements = elements;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.classList.add('visualizer-canvas');
    this.elements.container.innerHTML = '';
    this.elements.container.append(this.renderer.domElement);

    this.camera.position.set(4, 7.5, 42);
    this.camera.lookAt(this.cameraLookTarget);

    this.setupLights();

    this.rawSurface = this.createImageSurface('input', 280, 280, 6.4, new THREE.Vector3(-18, 0.2, 0), 0.16);
    this.processedSurface = this.createHeatmapSurface(
      'preprocess',
      'preprocess',
      28,
      28,
      4.2,
      new THREE.Vector3(-10.8, 0.1, 0),
      -0.14,
    );
    this.convSurfaces = [
      this.createHeatmapSurface('conv', 'conv', 28, 28, 3.5, new THREE.Vector3(-3.8, 1.4, 0.35), -0.08),
      this.createHeatmapSurface('conv', 'conv', 14, 14, 2.8, new THREE.Vector3(-3.5, -1.2, -0.45), -0.18),
    ];
    this.poolSurfaces = [
      this.createHeatmapSurface('pool', 'pool', 14, 14, 2.5, new THREE.Vector3(3.8, 1.2, 0.25), 0.08),
      this.createHeatmapSurface('pool', 'pool', 7, 7, 2.1, new THREE.Vector3(4.2, -1.25, -0.4), 0.18),
    ];
    this.inputBeam = this.createSweepBeam(this.rawSurface, 6.4, 0.46, 0.92, '#d9edff');
    this.preprocessBeam = this.createSweepBeam(this.processedSurface, 4.2, 0.36, 0.92, '#9bcfff');
    this.convBeams = [
      this.createSweepBeam(this.convSurfaces[0], 3.5, 0.54, 0.92, '#6fd4ff'),
      this.createSweepBeam(this.convSurfaces[1], 2.8, 0.46, 0.92, '#6fd4ff'),
    ];
    this.convKernels = [
      this.createKernelFrame(this.convSurfaces[0], 1.14, '#d7efff'),
      this.createKernelFrame(this.convSurfaces[1], 0.92, '#d7efff'),
    ];
    this.poolFrames = [
      this.createPoolFrame(this.poolSurfaces[0], 0.82, '#ff647e'),
      this.createPoolFrame(this.poolSurfaces[1], 0.68, '#ff647e'),
    ];

    this.createStagePlate('input', new THREE.Vector3(-18, -3.6, 0), 7.2, 3.2);
    this.createStagePlate('preprocess', new THREE.Vector3(-10.8, -3.45, 0), 5.2, 2.8);
    this.createStagePlate('conv', new THREE.Vector3(-3.6, -3.75, 0), 5.4, 3.1);
    this.createStagePlate('pool', new THREE.Vector3(4.1, -3.75, 0), 4.4, 2.9);

    this.flattenBars = this.createBarField(
      'flatten',
      72,
      18,
      0.16,
      0.16,
      0.23,
      3.6,
      new THREE.Vector3(12, -3.6, 0),
      ['#241c48', '#a98cff', '#ddd3ff'],
    );
    this.denseBars = this.createBarField(
      'dense',
      64,
      16,
      0.16,
      0.16,
      0.24,
      3.8,
      new THREE.Vector3(20.2, -3.55, 0),
      ['#154b2f', '#62d99d', '#97efbf'],
    );
    this.outputBars = this.createBarField(
      'output',
      10,
      10,
      0.44,
      0.44,
      0.64,
      7.2,
      new THREE.Vector3(29, -3.9, 0),
      ['#154b2f', '#62d99d', '#97efbf'],
    );

    this.setAnchor('input', new THREE.Vector3(-14.8, 0.15, 0));
    this.setAnchor('preprocess', new THREE.Vector3(-8.5, 0.1, 0));
    this.setAnchor('conv', new THREE.Vector3(-1.1, 0.15, 0));
    this.setAnchor('pool', new THREE.Vector3(6.4, 0.1, 0));
    this.setAnchor('flatten', new THREE.Vector3(14.6, -0.6, 0));
    this.setAnchor('dense', new THREE.Vector3(22.8, -0.4, 0));
    this.setAnchor('output', new THREE.Vector3(29, -0.3, 0));

    this.createConnector('input-preprocess', 'input', 'preprocess', 1.1);
    this.createConnector('preprocess-conv', 'preprocess', 'conv', 1.35);
    this.createConnector('conv-pool', 'conv', 'pool', 1.5);
    this.createConnector('pool-flatten', 'pool', 'flatten', 1.15);
    this.createConnector('flatten-dense', 'flatten', 'dense', 0.95);
    this.createConnector('dense-output', 'dense', 'output', 1.15);
    const flattenStream = this.createFlattenStream(this.getAnchor('pool'), this.getAnchor('flatten'));
    this.flattenStreamCurve = flattenStream.curve;
    this.flattenStreamLine = flattenStream.line;
    this.flattenStreamParticles = flattenStream.particles;
    this.outputHalo = this.createOutputHalo(this.getAnchor('output'));

    this.pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 18, 18),
      new THREE.MeshStandardMaterial({
        color: '#abd7ff',
        emissive: '#dff0ff',
        emissiveIntensity: 1.7,
        roughness: 0.2,
        metalness: 0.1,
      }),
    );
    this.scene.add(this.pulse);

    this.particles = this.createBackgroundParticles();
    this.scene.add(this.particles);

    this.resizeObserver = new ResizeObserver(() => this.resizeRenderer());
    this.resizeObserver.observe(this.elements.container);
    this.resizeRenderer();

    this.clear();
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  update(result: DetailedPredictionResult, imageData: ImageData): void {
    this.payload = result;
    this.playbackStart = performance.now();
    this.currentPhase = null;

    this.updateImageSurface(this.rawSurface, imageData);
    this.updateHeatmapSurface(this.processedSurface, result.visualization.input.values, 28, 28);
    this.updateHeatmapSurface(
      this.convSurfaces[0],
      result.visualization.conv[0].values,
      result.visualization.conv[0].width,
      result.visualization.conv[0].height,
    );
    this.updateHeatmapSurface(
      this.convSurfaces[1],
      result.visualization.conv[1].values,
      result.visualization.conv[1].width,
      result.visualization.conv[1].height,
    );
    this.updateHeatmapSurface(
      this.poolSurfaces[0],
      result.visualization.pooling[0].values,
      result.visualization.pooling[0].width,
      result.visualization.pooling[0].height,
    );
    this.updateHeatmapSurface(
      this.poolSurfaces[1],
      result.visualization.pooling[1].values,
      result.visualization.pooling[1].width,
      result.visualization.pooling[1].height,
    );

    this.flattenBars.values = fitValues(result.visualization.flatten.values, this.flattenBars.bars.length);
    this.denseBars.values = fitValues(result.visualization.dense.values, this.denseBars.bars.length);
    this.outputBars.values = fitValues(result.prediction.confidences, this.outputBars.bars.length);
  }

  clear(): void {
    this.payload = null;
    this.playbackStart = 0;
    this.currentPhase = null;

    this.fillCanvas(this.rawSurface.canvas, this.rawSurface.ctx, '#f4f8ff');
    this.rawSurface.texture.needsUpdate = true;

    this.drawHeatmapToCanvas(this.processedSurface.ctx, 28, 28, new Array(28 * 28).fill(0), 'preprocess');
    this.processedSurface.texture.needsUpdate = true;
    this.drawHeatmapToCanvas(this.convSurfaces[0].ctx, 28, 28, new Array(28 * 28).fill(0), 'conv');
    this.convSurfaces[0].texture.needsUpdate = true;
    this.drawHeatmapToCanvas(this.convSurfaces[1].ctx, 14, 14, new Array(14 * 14).fill(0), 'conv');
    this.convSurfaces[1].texture.needsUpdate = true;
    this.drawHeatmapToCanvas(this.poolSurfaces[0].ctx, 14, 14, new Array(14 * 14).fill(0), 'pool');
    this.poolSurfaces[0].texture.needsUpdate = true;
    this.drawHeatmapToCanvas(this.poolSurfaces[1].ctx, 7, 7, new Array(7 * 7).fill(0), 'pool');
    this.poolSurfaces[1].texture.needsUpdate = true;

    this.flattenBars.values = new Array(this.flattenBars.bars.length).fill(0);
    this.denseBars.values = new Array(this.denseBars.bars.length).fill(0);
    this.outputBars.values = new Array(this.outputBars.bars.length).fill(0);
    this.applyBarField(this.flattenBars, 1);
    this.applyBarField(this.denseBars, 1);
    this.applyBarField(this.outputBars, 1);
    this.rawSurface.mesh.scale.setScalar(1);
    this.processedSurface.mesh.scale.setScalar(1);
    this.convSurfaces[0].mesh.scale.setScalar(1);
    this.convSurfaces[1].mesh.scale.setScalar(1);
    this.poolSurfaces[0].mesh.scale.setScalar(1);
    this.poolSurfaces[1].mesh.scale.setScalar(1);
    this.outputBars.group.scale.setScalar(1);

    this.elements.detailTitleEl.textContent = 'Listo para analizar';
    this.elements.detailCopyEl.textContent =
      'Dibuja un numero y pulsa el boton principal para ver como la entrada se prepara, cruza la CNN y termina convertida en una distribucion de confianza.';
    this.elements.stagePillEl.textContent = 'Stand by';
    this.elements.stagePillEl.dataset.phase = 'idle';
    this.elements.stageLineEl.textContent = 'La escena esta lista para narrar el recorrido completo de tu numero.';
    this.elements.metricsEl.innerHTML = [
      metricRow('Entrada', '280x280 -> 28x28'),
      metricRow('Arquitectura', 'Conv -> Pool -> Flatten -> Dense'),
      metricRow('Lectura interna', 'Feature maps + embedding'),
      metricRow('Salida', '10 clases MNIST'),
    ].join('');

    this.updatePhaseUI(null);
    this.updateNodeUI(null, 0);
    this.pulse.visible = false;
    this.setBeamVisibility(this.inputBeam, false, 0);
    this.setBeamVisibility(this.preprocessBeam, false, 0);
    this.setBeamVisibility(this.convBeams[0], false, 0);
    this.setBeamVisibility(this.convBeams[1], false, 0);
    this.setKernelFrame(this.convKernels[0], 1, 0);
    this.setKernelFrame(this.convKernels[1], 1, 0);
    this.setPoolFrame(this.poolFrames[0], 1, 0);
    this.setPoolFrame(this.poolFrames[1], 1, 0);
    this.flattenStreamLine.visible = false;
    this.flattenStreamLine.material.opacity = 0;
    for (const particle of this.flattenStreamParticles) {
      particle.mesh.visible = false;
      particle.mesh.material.opacity = 0;
      particle.mesh.material.emissiveIntensity = 0;
    }
    this.outputHalo.visible = false;
    this.outputHalo.material.opacity = 0;
    this.outputHalo.material.emissiveIntensity = 0;
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
  }

  private readonly renderFrame = (): void => {
    const now = performance.now();
    this.animateFloatingObjects(now);
    this.animateBackground(now);

    if (this.payload) {
      const progress = Math.min((now - this.playbackStart) / (TOTAL_DURATION * 1000), 1);
      const phaseState = this.getPhaseState(progress);
      this.updatePhaseUI(phaseState.phase);
      this.updateNodeUI(phaseState.dominantNode, phaseState.visitedNodeCount);
      this.applyHighlights(phaseState);
      this.updateBars(progress);
      this.animateNarrativeObjects(phaseState, now);
      this.moveCamera(phaseState, now);
      this.updateDetails(phaseState.phase);
      this.pulse.visible = true;
      this.pulse.position.copy(phaseState.pulsePoint);
      this.currentPhase = phaseState.phase;
    } else {
      this.applyIdleHighlights();
      this.moveCamera(null, now);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private setupLights(): void {
    const ambient = new THREE.AmbientLight('#dbe9ff', 1.15);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight('#8fc8ff', 1.4);
    key.position.set(-8, 12, 16);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight('#4fd6c3', 0.7);
    rim.position.set(22, 6, -10);
    this.scene.add(rim);
  }

  private createImageSurface(
    node: VisualizerNode,
    width: number,
    height: number,
    size: number,
    position: THREE.Vector3,
    rotationY: number,
  ): HeatmapSurface {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context is not available for the image surface.');
    }

    this.fillCanvas(canvas, ctx, '#f4f8ff');

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: '#eef6ff',
      emissive: '#11253c',
      emissiveIntensity: 0.12,
      roughness: 0.52,
      metalness: 0.04,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(size, size);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.x = -0.18;
    mesh.rotation.y = rotationY;
    this.scene.add(mesh);
    this.addFrame(mesh, size, size, '#9dbdff');
    this.registerFloating(mesh, position, 0.18, 0.0011, 0.2);
    this.registerMaterial(node, material);

    return {
      mesh,
      material,
      texture,
      canvas,
      ctx,
      basePosition: position.clone(),
      size,
    };
  }

  private createHeatmapSurface(
    node: VisualizerNode,
    palette: HeatmapPalette,
    width: number,
    height: number,
    size: number,
    position: THREE.Vector3,
    rotationY: number,
  ): HeatmapSurface {
    const canvas = document.createElement('canvas');
    canvas.width = width * 10;
    canvas.height = height * 10;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context is not available for the heatmap surface.');
    }

    this.drawHeatmapToCanvas(ctx, width, height, new Array(width * height).fill(0), palette);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: '#eef6ff',
      emissive: '#11253c',
      emissiveIntensity: 0.12,
      roughness: 0.38,
      metalness: 0.08,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(size, size);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.x = -0.22;
    mesh.rotation.y = rotationY;
    this.scene.add(mesh);
    this.addFrame(mesh, size, size, '#89b7ff');
    this.registerFloating(mesh, position, 0.15, 0.00135, Math.abs(rotationY));
    this.registerMaterial(node, material);

    return {
      mesh,
      material,
      texture,
      canvas,
      ctx,
      basePosition: position.clone(),
      size,
      palette,
    };
  }

  private createSweepBeam(
    surface: HeatmapSurface,
    size: number,
    width: number,
    heightRatio: number,
    color: string,
  ): SweepBeam {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, size * heightRatio), material);
    mesh.position.z = 0.06;
    mesh.visible = false;
    surface.mesh.add(mesh);

    return {
      mesh,
      span: size - width,
    };
  }

  private createPoolFrame(surface: HeatmapSurface, size: number, color: string): PoolFrame {
    const geometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.LineSegments(geometry, material);
    mesh.position.z = 0.05;
    mesh.visible = false;
    surface.mesh.add(mesh);

    return {
      mesh,
      material,
      span: Math.max(surface.size - size, 0),
    };
  }

  private createKernelFrame(surface: HeatmapSurface, size: number, color: string): KernelFrame {
    const geometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.LineSegments(geometry, material);
    mesh.position.z = 0.08;
    mesh.visible = false;
    surface.mesh.add(mesh);

    return {
      mesh,
      material,
      span: Math.max(surface.size - size, 0),
    };
  }

  private createFlattenStream(
    from: THREE.Vector3,
    to: THREE.Vector3,
  ): {
    curve: THREE.CatmullRomCurve3;
    line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    particles: StreamParticle[];
  } {
    const midpoint = from.clone().lerp(to, 0.5);
    midpoint.y += 1.4;
    midpoint.z += 0.45;
    const curve = new THREE.CatmullRomCurve3([from, midpoint, to]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(42));
    const material = new THREE.LineBasicMaterial({
      color: '#9f8dff',
      transparent: true,
      opacity: 0,
    });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    const particles: StreamParticle[] = [];
    for (let index = 0; index < 18; index += 1) {
      const particleMaterial = new THREE.MeshStandardMaterial({
        color: '#c9baff',
        emissive: '#8b73ff',
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
        roughness: 0.2,
        metalness: 0.12,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), particleMaterial);
      mesh.visible = false;
      this.scene.add(mesh);
      particles.push({
        mesh,
        offset: index / 18,
      });
    }

    return {
      curve,
      line,
      particles,
    };
  }

  private createOutputHalo(anchor: THREE.Vector3): THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial> {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.08, 18, 64),
      new THREE.MeshStandardMaterial({
        color: '#62d99d',
        emissive: '#97efbf',
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
        roughness: 0.18,
        metalness: 0.08,
      }),
    );
    halo.position.set(anchor.x, anchor.y + 1.6, anchor.z);
    halo.rotation.y = Math.PI / 2;
    this.scene.add(halo);
    return halo;
  }

  private createStagePlate(node: VisualizerNode, position: THREE.Vector3, width: number, depth: number): void {
    const geometry = new THREE.BoxGeometry(width, 0.18, depth);
    const material = new THREE.MeshStandardMaterial({
      color: '#11192c',
      emissive: '#08111f',
      emissiveIntensity: 0.08,
      roughness: 0.74,
      metalness: 0.14,
      transparent: true,
      opacity: 0.78,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.registerMaterial(node, material);
  }

  private createBarField(
    node: VisualizerNode,
    count: number,
    columns: number,
    barWidth: number,
    barDepth: number,
    spacing: number,
    maxHeight: number,
    position: THREE.Vector3,
    colors: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation],
  ): BarField {
    const group = new THREE.Group();
    group.position.copy(position);
    this.scene.add(group);

    const rows = Math.ceil(count / columns);
    const geometry = new THREE.BoxGeometry(barWidth, 1, barDepth);
    geometry.translate(0, 0.5, 0);

    const basePlate = new THREE.Mesh(
      new THREE.BoxGeometry(columns * spacing + 1, 0.16, rows * spacing + 1),
      new THREE.MeshStandardMaterial({
        color: '#11192c',
        emissive: '#08111f',
        emissiveIntensity: 0.08,
        roughness: 0.78,
        metalness: 0.12,
        transparent: true,
        opacity: 0.84,
      }),
    );
    basePlate.position.y = -0.08;
    group.add(basePlate);
    this.registerMaterial(node, basePlate.material as THREE.MeshStandardMaterial);

    const bars: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>> = [];
    const materials: THREE.MeshStandardMaterial[] = [];
    const xOffset = ((columns - 1) * spacing) / 2;
    const zOffset = ((rows - 1) * spacing) / 2;

    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const material = new THREE.MeshStandardMaterial({
        color: '#22314e',
        emissive: '#162238',
        emissiveIntensity: 0.18,
        roughness: 0.35,
        metalness: 0.08,
      });
      const bar = new THREE.Mesh(geometry, material);
      bar.position.set(column * spacing - xOffset, 0.01, row * spacing - zOffset);
      bar.scale.y = 0.02;
      group.add(bar);
      bars.push(bar);
      materials.push(material);
      this.registerMaterial(node, material);
    }

    this.registerFloating(group, position, 0.12, 0.0011, position.x * 0.08);

    return {
      group,
      bars,
      materials,
      values: new Array(count).fill(0),
      basePosition: position.clone(),
      maxHeight,
      colors,
    };
  }

  private addFrame(mesh: THREE.Mesh, width: number, height: number, color: string): void {
    const edges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height));
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
      }),
    );
    line.position.copy(mesh.position);
    line.rotation.copy(mesh.rotation);
    this.scene.add(line);
  }

  private setAnchor(node: VisualizerNode, position: THREE.Vector3): void {
    this.nodeAnchors.set(node, position);
  }

  private createConnector(id: string, from: VisualizerNode, to: VisualizerNode, lift: number): void {
    const start = this.getAnchor(from);
    const end = this.getAnchor(to);
    const midpoint = start.clone().lerp(end, 0.5);
    midpoint.y += lift;
    const curve = new THREE.CatmullRomCurve3([start, midpoint, end]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
    const material = new THREE.LineBasicMaterial({
      color: '#5c6f97',
      transparent: true,
      opacity: 0.26,
    });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    this.connectors.set(id, {
      id,
      from,
      to,
      curve,
      material,
    });
  }

  private createBackgroundParticles(): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];

    for (let index = 0; index < 180; index += 1) {
      const x = -22 + Math.random() * 56;
      const y = -8 + Math.random() * 18;
      const z = -9 + Math.random() * 18;
      vertices.push(x, y, z);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: '#b9d8ff',
        size: 0.08,
        transparent: true,
        opacity: 0.3,
        sizeAttenuation: true,
      }),
    );
  }

  private resizeRenderer(): void {
    const { clientWidth, clientHeight } = this.elements.container;
    const width = Math.max(clientWidth, 320);
    const height = Math.max(clientHeight, 340);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animateFloatingObjects(now: number): void {
    for (const item of this.floatingObjects) {
      const offset = Math.sin(now * item.speed + item.phase) * item.amplitude;
      item.object.position.set(
        item.basePosition.x,
        item.basePosition.y + offset,
        item.basePosition.z,
      );
    }
  }

  private animateBackground(now: number): void {
    this.particles.rotation.y = now * 0.00003;
    this.particles.rotation.x = Math.sin(now * 0.00005) * 0.06;
  }

  private moveCamera(state: PhaseState | null, now: number): void {
    const pose = this.getCameraPose(state, now);
    this.camera.position.lerp(pose.position, state ? 0.085 : 0.03);
    this.cameraLookTarget.lerp(pose.lookAt, state ? 0.11 : 0.03);
    this.camera.lookAt(this.cameraLookTarget);
  }

  private getCameraPose(state: PhaseState | null, now: number): CameraPose {
    if (!state) {
      return {
        position: new THREE.Vector3(4 + Math.sin(now * 0.00018) * 1.1, 7.5, 42),
        lookAt: new THREE.Vector3(5, -0.5, 0),
      };
    }

    if (state.phase === 'preprocess') {
      return {
        position: new THREE.Vector3(
          -13.5 + state.phaseProgress * 3.8,
          4.8 + Math.sin(now * 0.0015) * 0.18,
          15.5,
        ),
        lookAt: new THREE.Vector3(-12.2 + state.phaseProgress * 4.1, -0.2, 0),
      };
    }

    if (state.phase === 'cnn') {
      const x = state.phaseProgress < 0.5
        ? remap(state.phaseProgress, 0, 0.5, -2.6, 4.8)
        : remap(state.phaseProgress, 0.5, 1, 8.5, 15.4);

      return {
        position: new THREE.Vector3(x, 5.7 + Math.sin(now * 0.0014) * 0.16, 13.5),
        lookAt: new THREE.Vector3(x + 0.8, -0.4, 0),
      };
    }

    if (state.phase === 'activations') {
      return {
        position: new THREE.Vector3(
          9.8 + Math.sin(now * 0.0011) * 1.2,
          4.7 + Math.cos(now * 0.00135) * 0.24,
          11.8,
        ),
        lookAt: new THREE.Vector3(9.6, -0.1, 0),
      };
    }

    return {
      position: new THREE.Vector3(
        24.5 + Math.sin(now * 0.0011) * 0.45,
        5.4 + Math.cos(now * 0.0012) * 0.18,
        12.4 - state.phaseProgress * 0.9,
      ),
      lookAt: new THREE.Vector3(28.4, 0.2, 0),
    };
  }

  private animateNarrativeObjects(state: PhaseState, now: number): void {
    const preprocessWave = state.phase === 'preprocess' ? 0.4 + state.phaseProgress * 0.6 : 0;
    const cnnWave = state.phase === 'cnn' ? 0.24 + state.phaseProgress * 0.76 : 0;
    const activationWave = state.phase === 'activations' ? 0.55 + Math.sin(now * 0.004) * 0.12 : 0;
    const outputWave = state.phase === 'output' ? 0.35 + state.phaseProgress * 0.65 : 0;

    this.setBeamVisibility(
      this.inputBeam,
      state.phase === 'preprocess',
      preprocessWave,
      fract(state.phaseProgress * 1.1),
    );
    this.setBeamVisibility(
      this.preprocessBeam,
      state.phase === 'preprocess',
      preprocessWave,
      fract(state.phaseProgress * 1.1 + 0.5),
    );
    this.setBeamVisibility(
      this.convBeams[0],
      state.phase === 'cnn' || state.phase === 'activations',
      Math.max(cnnWave, activationWave),
      fract(state.globalProgress * 1.8),
    );
    this.setBeamVisibility(
      this.convBeams[1],
      state.phase === 'cnn' || state.phase === 'activations',
      Math.max(cnnWave, activationWave),
      fract(state.globalProgress * 2.05 + 0.35),
    );

    const convKernelStrength =
      state.phase === 'cnn'
        ? 0.74 + state.phaseProgress * 0.26
        : state.phase === 'activations'
          ? 0.58
          : 0;
    this.setKernelFrame(
      this.convKernels[0],
      0.96 + Math.sin(now * 0.0042) * 0.05,
      convKernelStrength,
      fract(state.phaseProgress * 1.35),
      0.22 + (Math.sin(now * 0.0022) * 0.5 + 0.5) * 0.56,
    );
    this.setKernelFrame(
      this.convKernels[1],
      0.94 + Math.cos(now * 0.0046) * 0.05,
      convKernelStrength * 0.92,
      fract(state.phaseProgress * 1.75 + 0.28),
      0.18 + (Math.cos(now * 0.0026) * 0.5 + 0.5) * 0.52,
    );

    const poolStrength =
      state.phase === 'cnn'
        ? state.dominantNode === 'pool'
          ? 1
          : 0.42 + state.phaseProgress * 0.25
        : state.phase === 'activations'
          ? 0.78
          : 0;
    this.setPoolFrame(
      this.poolFrames[0],
      0.98 + Math.sin(now * 0.005) * 0.06,
      poolStrength,
      fract(state.phaseProgress * 1.2 + 0.18),
      0.2 + (Math.cos(now * 0.0023) * 0.5 + 0.5) * 0.54,
    );
    this.setPoolFrame(
      this.poolFrames[1],
      0.96 + Math.cos(now * 0.0052) * 0.06,
      poolStrength * 0.88,
      fract(state.phaseProgress * 1.55 + 0.46),
      0.16 + (Math.sin(now * 0.0027) * 0.5 + 0.5) * 0.5,
    );

    const streamStrength =
      state.phase === 'cnn'
        ? remap(state.phaseProgress, 0.34, 1, 0, 1)
        : state.phase === 'activations'
          ? 0.92
          : state.phase === 'output'
            ? remap(1 - state.phaseProgress, 0, 1, 0.75, 0)
            : 0;
    this.animateFlattenStream(now, streamStrength);
    this.animateOutputHalo(now, outputWave);
    this.animateOutputWinner(outputWave);
    this.animateSurfacePresence(state, now);
    this.updatePulseColor(state.phase);
  }

  private animateSurfacePresence(state: PhaseState, now: number): void {
    const idleWave = Math.sin(now * 0.0015) * 0.018;
    const preprocessBoost = state.phase === 'preprocess' ? 0.08 : 0;
    const convBoost = state.phase === 'cnn' || state.phase === 'activations' ? 0.06 : 0;
    const outputBoost = state.phase === 'output' ? 0.08 : 0;

    this.rawSurface.mesh.scale.setScalar(1 + idleWave + preprocessBoost);
    this.processedSurface.mesh.scale.setScalar(1 + idleWave * 0.7 + preprocessBoost * 0.8);
    this.convSurfaces[0].mesh.scale.setScalar(1 + idleWave * 0.4 + convBoost);
    this.convSurfaces[1].mesh.scale.setScalar(1 + idleWave * 0.35 + convBoost * 0.9);
    this.poolSurfaces[0].mesh.scale.setScalar(1 + idleWave * 0.3 + convBoost * 0.65);
    this.poolSurfaces[1].mesh.scale.setScalar(1 + idleWave * 0.24 + convBoost * 0.55);
    this.outputBars.group.scale.setScalar(1 + outputBoost * 0.03);
  }

  private animateFlattenStream(now: number, strength: number): void {
    const lineMaterial = this.flattenStreamLine.material as THREE.LineBasicMaterial;
    this.flattenStreamLine.visible = strength > 0.02;
    lineMaterial.opacity = strength * 0.42;

    for (const particle of this.flattenStreamParticles) {
      const progress = fract(now * 0.00024 + particle.offset);
      const point = this.flattenStreamCurve.getPointAt(progress);
      particle.mesh.position.copy(point);
      particle.mesh.visible = strength > 0.04;
      particle.mesh.material.opacity = strength * (0.2 + progress * 0.5);
      particle.mesh.material.emissiveIntensity = strength * (0.35 + progress * 0.5);
    }
  }

  private animateOutputHalo(now: number, strength: number): void {
    this.outputHalo.visible = strength > 0.03;
    this.outputHalo.material.opacity = strength * 0.64;
    this.outputHalo.material.emissiveIntensity = strength * 1.35;
    const scale = 1 + strength * 0.16 + Math.sin(now * 0.0045) * 0.03;
    this.outputHalo.scale.set(scale, scale, scale);
    this.outputHalo.rotation.z = now * 0.00045;
  }

  private updatePulseColor(phase: VisualizerPhase): void {
    if (phase === 'cnn') {
      this.pulse.material.color.set('#6fd4ff');
      this.pulse.material.emissive.set('#8fe8ff');
      return;
    }

    if (phase === 'activations') {
      this.pulse.material.color.set('#b79dff');
      this.pulse.material.emissive.set('#ddd3ff');
      return;
    }

    if (phase === 'output') {
      this.pulse.material.color.set('#62d99d');
      this.pulse.material.emissive.set('#97efbf');
      return;
    }

    this.pulse.material.color.set('#abd7ff');
    this.pulse.material.emissive.set('#dff0ff');
  }

  private animateOutputWinner(strength: number): void {
    if (!this.payload) {
      return;
    }

    const winnerIndex = this.payload.prediction.topClass;
    for (let index = 0; index < this.outputBars.bars.length; index += 1) {
      const bar = this.outputBars.bars[index];
      const material = this.outputBars.materials[index];
      const isWinner = index === winnerIndex;
      bar.scale.x = isWinner ? 1 + strength * 0.14 : 1;
      bar.scale.z = isWinner ? 1 + strength * 0.14 : 1;
      material.emissiveIntensity += isWinner ? strength * 0.45 : 0;
    }
  }

  private setBeamVisibility(beam: SweepBeam, visible: boolean, strength: number, travel = 0.5): void {
    beam.mesh.visible = visible;
    beam.mesh.material.opacity = visible ? Math.max(0, Math.min(0.74, strength * 0.72)) : 0;
    beam.mesh.position.x = -beam.span / 2 + beam.span * travel;
  }

  private setKernelFrame(
    frame: KernelFrame,
    scale: number,
    strength: number,
    travelX = 0.5,
    travelY = 0.5,
  ): void {
    frame.mesh.visible = strength > 0.02;
    frame.material.opacity = strength * 0.92;
    frame.mesh.scale.setScalar(scale);
    frame.mesh.position.x = -frame.span / 2 + frame.span * travelX;
    frame.mesh.position.y = -frame.span / 2 + frame.span * travelY;
  }

  private setPoolFrame(
    frame: PoolFrame,
    scale: number,
    strength: number,
    travelX = 0.5,
    travelY = 0.5,
  ): void {
    frame.mesh.visible = strength > 0.02;
    frame.material.opacity = strength * 0.96;
    frame.mesh.scale.setScalar(scale);
    frame.mesh.position.x = -frame.span / 2 + frame.span * travelX;
    frame.mesh.position.y = -frame.span / 2 + frame.span * travelY;
  }

  private registerFloating(
    object: THREE.Object3D,
    basePosition: THREE.Vector3,
    amplitude: number,
    speed: number,
    phase: number,
  ): void {
    this.floatingObjects.push({
      object,
      basePosition: basePosition.clone(),
      amplitude,
      speed,
      phase,
    });
  }

  private updateImageSurface(surface: HeatmapSurface, imageData: ImageData): void {
    surface.ctx.putImageData(imageData, 0, 0);
    surface.texture.needsUpdate = true;
  }

  private updateHeatmapSurface(surface: HeatmapSurface, values: number[], width: number, height: number): void {
    this.drawHeatmapToCanvas(surface.ctx, width, height, values, surface.palette ?? 'preprocess');
    surface.texture.needsUpdate = true;
  }

  private drawHeatmapToCanvas(
    ctx: CanvasRenderingContext2D,
    logicalWidth: number,
    logicalHeight: number,
    values: number[],
    palette: HeatmapPalette,
  ): void {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const cellWidth = canvasWidth / logicalWidth;
    const cellHeight = canvasHeight / logicalHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#070d16';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (let y = 0; y < logicalHeight; y += 1) {
      for (let x = 0; x < logicalWidth; x += 1) {
        const value = clamp01(values[y * logicalWidth + x] ?? 0);
        ctx.fillStyle = heatmapColor(value, palette);
        ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      }
    }

    ctx.strokeStyle = 'rgba(188, 219, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= logicalWidth; x += 1) {
      const px = x * cellWidth;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= logicalHeight; y += 1) {
      const py = y * cellHeight;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvasWidth, py);
      ctx.stroke();
    }
  }

  private fillCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, color: string): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private getPhaseState(progress: number): PhaseState {
    const preprocessEnd = PHASE_DURATION.preprocess / TOTAL_DURATION;
    const cnnEnd = (PHASE_DURATION.preprocess + PHASE_DURATION.cnn) / TOTAL_DURATION;
    const activationsEnd =
      (PHASE_DURATION.preprocess + PHASE_DURATION.cnn + PHASE_DURATION.activations) / TOTAL_DURATION;

    if (progress < preprocessEnd) {
      const local = progress / preprocessEnd;
      return {
        phase: 'preprocess',
        dominantNode: local < 0.5 ? 'input' : 'preprocess',
        visitedNodeCount: local < 0.5 ? 1 : 2,
        pulseConnectorId: 'input-preprocess',
        pulsePoint: this.getConnectorPoint('input-preprocess', easeInOut(local)),
        phaseProgress: local,
        globalProgress: progress,
      };
    }

    if (progress < cnnEnd) {
      const local = (progress - preprocessEnd) / (cnnEnd - preprocessEnd);
      const connectors = ['preprocess-conv', 'conv-pool', 'pool-flatten', 'flatten-dense'] as const;
      const connectorIndex = Math.min(Math.floor(local * connectors.length), connectors.length - 1);
      const connectorProgress = local * connectors.length - connectorIndex;
      const dominantNode = ['conv', 'pool', 'flatten', 'dense'][connectorIndex] as VisualizerNode;

      return {
        phase: 'cnn',
        dominantNode,
        visitedNodeCount: connectorIndex + 3,
        pulseConnectorId: connectors[connectorIndex],
        pulsePoint: this.getConnectorPoint(connectors[connectorIndex], easeInOut(connectorProgress)),
        phaseProgress: local,
        globalProgress: progress,
      };
    }

    if (progress < activationsEnd) {
      const local = (progress - cnnEnd) / (activationsEnd - cnnEnd);
      const cycle = local < 0.34 ? 'conv' : local < 0.68 ? 'pool' : 'dense';
      const anchor = this.getAnchor(cycle);
      const angle = local * Math.PI * 6;
      const radius = 0.75;

      return {
        phase: 'activations',
        dominantNode: cycle,
        visitedNodeCount: 6,
        pulseConnectorId: null,
        pulsePoint: new THREE.Vector3(
          anchor.x + Math.cos(angle) * radius,
          anchor.y + 0.4 + Math.sin(angle * 1.35) * 0.45,
          anchor.z + Math.sin(angle) * radius * 0.4,
        ),
        phaseProgress: local,
        globalProgress: progress,
      };
    }

    const local = (progress - activationsEnd) / Math.max(1 - activationsEnd, 1e-6);
    return {
      phase: 'output',
      dominantNode: 'output',
      visitedNodeCount: NODE_ORDER.length,
      pulseConnectorId: 'dense-output',
      pulsePoint: this.getConnectorPoint('dense-output', easeInOut(local)),
      phaseProgress: local,
      globalProgress: progress,
    };
  }

  private updateBars(progress: number): void {
    const preprocessEnd = PHASE_DURATION.preprocess / TOTAL_DURATION;
    const cnnEnd = (PHASE_DURATION.preprocess + PHASE_DURATION.cnn) / TOTAL_DURATION;
    const activationsEnd =
      (PHASE_DURATION.preprocess + PHASE_DURATION.cnn + PHASE_DURATION.activations) / TOTAL_DURATION;

    const flattenReveal = progress < preprocessEnd ? 0.05 : progress < cnnEnd ? remap(progress, preprocessEnd, cnnEnd, 0.12, 1) : 1;
    const denseReveal = progress < preprocessEnd ? 0.04 : progress < cnnEnd ? remap(progress, preprocessEnd, cnnEnd, 0.04, 1) : 1;
    const outputReveal = progress < activationsEnd ? 0.04 : remap(progress, activationsEnd, 1, 0.04, 1);

    this.applyBarField(this.flattenBars, flattenReveal);
    this.applyBarField(this.denseBars, denseReveal);
    this.applyBarField(this.outputBars, outputReveal);
  }

  private applyBarField(field: BarField, reveal: number): void {
    const [lowColor, highColor, emphasisColor] = field.colors;
    const low = new THREE.Color(lowColor);
    const high = new THREE.Color(highColor);
    const emphasis = new THREE.Color(emphasisColor);

    for (let index = 0; index < field.bars.length; index += 1) {
      const value = clamp01(field.values[index] ?? 0);
      const height = 0.03 + value * field.maxHeight * reveal;
      const bar = field.bars[index];
      bar.scale.y = height;

      const material = field.materials[index];
      material.color.copy(low).lerp(high, value);
      material.emissive.copy(low).lerp(emphasis, value);
      material.emissiveIntensity = 0.12 + reveal * 0.55 + value * 0.2;
    }
  }

  private applyHighlights(state: PhaseState): void {
    const activeConnector = state.pulseConnectorId;
    for (const connector of this.connectors.values()) {
      const isActive = connector.id === activeConnector;
      connector.material.opacity = isActive ? 0.92 : 0.24;
      connector.material.color.set(isActive ? '#a9ddff' : '#5c6f97');
    }

    for (const node of NODE_ORDER) {
      const materials = this.nodeMaterials.get(node) ?? [];
      const nodeIndex = NODE_ORDER.indexOf(node);
      let emphasis = 0.16;

      if (node === state.dominantNode) {
        emphasis = 1;
      } else if (nodeIndex < state.visitedNodeCount) {
        emphasis = 0.42;
      }

      if (state.phase === 'activations' && (node === 'conv' || node === 'pool' || node === 'dense')) {
        emphasis = node === state.dominantNode ? 1 : 0.72;
      }

      if (state.phase === 'output' && node === 'dense') {
        emphasis = 0.65;
      }

      for (const material of materials) {
        material.emissiveIntensity = 0.08 + emphasis * 0.58;
        material.opacity = material.transparent ? 0.6 + emphasis * 0.36 : material.opacity;
      }
    }
  }

  private applyIdleHighlights(): void {
    for (const connector of this.connectors.values()) {
      connector.material.opacity = 0.24;
    }
    for (const materials of this.nodeMaterials.values()) {
      for (const material of materials) {
        material.emissiveIntensity = 0.14;
        material.opacity = material.transparent ? 0.88 : material.opacity;
      }
    }
  }

  private updatePhaseUI(phase: VisualizerPhase | null): void {
    for (const [phaseId, element] of Object.entries(this.elements.phaseEls) as Array<[VisualizerPhase, HTMLElement]>) {
      element.classList.toggle('active', phase === phaseId);
      element.classList.toggle('complete', phase !== null && isPhaseBefore(phaseId, phase));
    }
  }

  private updateNodeUI(currentNode: VisualizerNode | null, visitedNodeCount: number): void {
    for (const [node, element] of Object.entries(this.elements.nodeEls) as Array<[VisualizerNode, HTMLElement]>) {
      const nodeIndex = NODE_ORDER.indexOf(node);
      element.classList.toggle('active', currentNode === node);
      element.classList.toggle('visited', currentNode !== null && nodeIndex < visitedNodeCount);
    }
  }

  private updateDetails(phase: VisualizerPhase): void {
    if (!this.payload) {
      return;
    }

    if (phase === this.currentPhase) {
      return;
    }

    const { prediction, visualization } = this.payload;

    if (phase === 'preprocess') {
      this.elements.stagePillEl.textContent = 'Input';
      this.elements.stagePillEl.dataset.phase = 'preprocess';
      this.elements.stageLineEl.textContent = 'Centering the stroke and compressing it into the 28x28 tensor.';
      this.elements.detailTitleEl.textContent = '1. Preparando la entrada';
      this.elements.detailCopyEl.textContent =
        'Primero la app detecta donde esta tu trazo, lo centra y lo reduce a la version 28x28 que realmente consume el modelo.';
      this.elements.metricsEl.innerHTML = [
        metricRow('Canvas', '280x280'),
        metricRow('Entrada util', `${visualization.input.width}x${visualization.input.height}`),
        metricRow('Cobertura de tinta', `${(visualization.input.nonZeroRatio * 100).toFixed(1)}%`),
        metricRow('Pixel mas intenso', `${(visualization.input.peak * 100).toFixed(1)}%`),
      ].join('');
      return;
    }

    if (phase === 'cnn') {
      this.elements.stagePillEl.textContent = 'CNN';
      this.elements.stagePillEl.dataset.phase = 'cnn';
      this.elements.stageLineEl.textContent = 'Barridos de convolucion y pooling para encontrar rasgos utiles del trazo.';
      this.elements.detailTitleEl.textContent = '2. Recorriendo la CNN';
      this.elements.detailCopyEl.textContent =
        'Ahora la senal atraviesa bloques Conv y Pooling para detectar trazos, reducir espacio y condensar la informacion antes de clasificar.';
      this.elements.metricsEl.innerHTML = [
        metricRow('Conv block 1', shapeLabel(visualization.conv[0].shape)),
        metricRow('Pool block 1', shapeLabel(visualization.pooling[0].shape)),
        metricRow('Conv block 2', shapeLabel(visualization.conv[1].shape)),
        metricRow('Flatten -> Dense', `${visualization.flatten.shape[0]} -> ${visualization.dense.shape[0]}`),
      ].join('');
      return;
    }

    if (phase === 'activations') {
      this.elements.stagePillEl.textContent = 'Activations';
      this.elements.stagePillEl.dataset.phase = 'activations';
      this.elements.stageLineEl.textContent = 'Las zonas brillantes revelan que patrones internos se estan activando.';
      this.elements.detailTitleEl.textContent = '3. Activaciones intermedias';
      this.elements.detailCopyEl.textContent =
        'Las zonas mas encendidas muestran donde la red esta encontrando bordes, curvas y combinaciones de rasgos que se parecen a un digito.';
      this.elements.metricsEl.innerHTML = [
        metricRow('Pico Conv', `${(visualization.conv[0].peak * 100).toFixed(1)}% / ${(visualization.conv[1].peak * 100).toFixed(1)}%`),
        metricRow('Pico Pool', `${(visualization.pooling[0].peak * 100).toFixed(1)}% / ${(visualization.pooling[1].peak * 100).toFixed(1)}%`),
        metricRow('Muestra Flatten', `${visualization.flatten.sampledLength} de ${visualization.flatten.sourceLength}`),
        metricRow('Muestra Dense', `${visualization.dense.sampledLength} de ${visualization.dense.sourceLength}`),
      ].join('');
      return;
    }

    this.elements.stagePillEl.textContent = 'Output';
    this.elements.stagePillEl.dataset.phase = 'output';
    this.elements.stageLineEl.textContent = 'La red reparte confianza y empuja una clase por encima de las demas.';
    this.elements.detailTitleEl.textContent = '4. Decision final';
    this.elements.detailCopyEl.textContent =
      'Al final, la salida reparte confianza entre los 10 digitos posibles. La barra mas alta es la lectura final del modelo.';
    this.elements.metricsEl.innerHTML = [
      metricRow('Digito ganador', String(prediction.topClass)),
      metricRow('Confianza principal', `${(prediction.topConfidence * 100).toFixed(2)}%`),
      metricRow(
        'Segundo lugar',
        `${prediction.ranking[1].digit} (${(prediction.ranking[1].confidence * 100).toFixed(2)}%)`,
      ),
      metricRow(
        'Brecha de confianza',
        `${((prediction.topConfidence - prediction.ranking[1].confidence) * 100).toFixed(2)} pts`,
      ),
    ].join('');
  }

  private registerMaterial(node: VisualizerNode, material: THREE.MeshStandardMaterial): void {
    const existing = this.nodeMaterials.get(node);
    if (existing) {
      existing.push(material);
      return;
    }

    this.nodeMaterials.set(node, [material]);
  }

  private getConnectorPoint(connectorId: string, progress: number): THREE.Vector3 {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new Error(`Connector "${connectorId}" does not exist.`);
    }

    return connector.curve.getPointAt(progress);
  }

  private getAnchor(node: VisualizerNode): THREE.Vector3 {
    const anchor = this.nodeAnchors.get(node);
    if (!anchor) {
      throw new Error(`Node anchor "${node}" was not configured.`);
    }

    return anchor.clone();
  }
}

function metricRow(label: string, value: string): string {
  return `
    <div class="viz-metric-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function shapeLabel(shape: number[]): string {
  return shape.join(' x ');
}

function heatmapColor(value: number, palette: HeatmapPalette): string {
  if (palette === 'conv') {
    const hue = 203 + value * 12;
    const saturation = 58 + value * 26;
    const lightness = 11 + value * 56;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  if (palette === 'pool') {
    const hue = 338 + value * 10;
    const saturation = 56 + value * 24;
    const lightness = 12 + value * 54;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  const hue = 208 + value * 10;
  const saturation = 46 + value * 22;
  const lightness = 11 + value * 56;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function fitValues(values: number[], size: number): number[] {
  if (values.length === size) {
    return [...values];
  }

  if (values.length > size) {
    const fitted: number[] = [];
    for (let index = 0; index < size; index += 1) {
      const sourceIndex = Math.floor((index * (values.length - 1)) / Math.max(size - 1, 1));
      fitted.push(values[sourceIndex]);
    }
    return fitted;
  }

  return [...values, ...new Array(size - values.length).fill(0)];
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function easeInOut(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function remap(value: number, inStart: number, inEnd: number, outStart: number, outEnd: number): number {
  if (value <= inStart) {
    return outStart;
  }

  if (value >= inEnd) {
    return outEnd;
  }

  const progress = (value - inStart) / Math.max(inEnd - inStart, 1e-6);
  return outStart + (outEnd - outStart) * easeInOut(progress);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function isPhaseBefore(target: VisualizerPhase, current: VisualizerPhase): boolean {
  const order: VisualizerPhase[] = ['preprocess', 'cnn', 'activations', 'output'];
  return order.indexOf(target) < order.indexOf(current);
}
