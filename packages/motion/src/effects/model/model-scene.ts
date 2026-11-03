import {
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Material,
  type Mesh,
  NeutralToneMapping,
  type Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Sphere,
  type Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { findLightPreset } from "./light-presets.js";
import { describeModel, findUnsupportedExtension, needsMeshopt } from "./model-file.js";

/**
 * A model drawn with three.js (MIT): loaded from its address, centred, lit with one of the
 * light presets and framed so it always fits. This file is a chunk of its own, imported only
 * when a page's 3D model comes near the screen on a device that can draw it.
 */

export interface ModelSceneOptions {
  src: string;
  light: string;
  /** "transparent", or a colour like "#f4f1ec". */
  background: string;
  pixelRatio: number;
  lowPower: boolean;
  /** Keeps the last picture, so it can be saved (the builder's poster). */
  keepPicture?: boolean;
}

export interface ModelScene {
  /** Draws the model turned `turn` radians about the vertical axis and tilted `tilt`. */
  draw(turn: number, tilt: number): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export class ModelLoadError extends Error {
  constructor(reason: string) {
    super(`The 3D model can't be shown: ${reason}`);
    this.name = "ModelLoadError";
  }
}

const FIELD_OF_VIEW = 30;

async function loadModel(src: string): Promise<Object3D> {
  const response = await fetch(src, { credentials: "omit" });
  if (!response.ok) throw new ModelLoadError(`the file answered ${response.status}`);
  const buffer = await response.arrayBuffer();
  const description = describeModel(buffer);
  if (!description) throw new ModelLoadError("the file isn't a glTF model");
  const unsupported = findUnsupportedExtension(description);
  if (unsupported) throw new ModelLoadError(`it uses ${unsupported}`);
  const loader = new GLTFLoader();
  if (needsMeshopt(description)) {
    const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  const gltf = await loader.parseAsync(buffer, "");
  return gltf.scene;
}

function disposeAll(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    const materials: Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      }
      material.dispose();
    }
  });
}

export async function createModelScene(
  canvas: HTMLCanvasElement,
  options: ModelSceneOptions,
): Promise<ModelScene> {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !options.lowPower,
    powerPreference: options.lowPower ? "low-power" : "default",
    preserveDrawingBuffer: options.keepPicture === true,
  });
  const preset = findLightPreset(options.light);
  renderer.setPixelRatio(options.pixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = preset.exposure;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environment = environment;
  scene.environmentIntensity = preset.environment;
  if (/^#[0-9a-f]{6}$/i.test(options.background)) {
    scene.background = new Color(options.background);
  } else {
    renderer.setClearColor(0x000000, 0);
  }
  if (preset.hemisphere) {
    const { sky, ground, intensity } = preset.hemisphere;
    scene.add(new HemisphereLight(sky, ground, intensity));
  }
  for (const setting of preset.lights) {
    const light = new DirectionalLight(setting.colour, setting.intensity);
    light.position.set(...setting.position);
    scene.add(light);
  }

  let model: Object3D;
  try {
    model = await loadModel(options.src);
  } catch (error) {
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
  // Turned about its own middle, whatever the file's origin.
  const box = new Box3().setFromObject(model);
  const sphere = box.getBoundingSphere(new Sphere());
  model.position.sub(sphere.center);
  const pivot = new Group();
  pivot.add(model);
  scene.add(pivot);
  const radius = Math.max(sphere.radius, 0.0001);

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, radius / 100, radius * 100);
  const frame = (aspect: number) => {
    // Fits the model's sphere in the narrower of the two directions, with a little margin.
    const vertical = (FIELD_OF_VIEW * Math.PI) / 360;
    const half = aspect < 1 ? Math.atan(Math.tan(vertical) * aspect) : vertical;
    const distance = (radius / Math.sin(half)) * 1.08;
    camera.aspect = aspect;
    camera.position.copy(new Vector3(0, radius * 0.18, distance));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  frame(1);

  return {
    draw(turn, tilt) {
      pivot.rotation.set(tilt, turn, 0);
      renderer.render(scene, camera);
    },
    resize(width, height) {
      if (width < 1 || height < 1) return;
      renderer.setSize(width, height, false);
      frame(width / height);
    },
    destroy() {
      disposeAll(model);
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
