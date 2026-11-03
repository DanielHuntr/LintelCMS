/**
 * The four looks a model can be lit with. Each mixes the soft reflections of a room (the
 * environment), a key light and a fill or rim light. Plain data, read by model-scene.ts.
 */

export const lightPresetNames = ["studio", "daylight", "dramatic", "night"] as const;
export type LightPresetName = (typeof lightPresetNames)[number];

export interface DirectionalLightSetting {
  colour: number;
  intensity: number;
  position: readonly [number, number, number];
}

export interface LightPreset {
  /** How strongly the room's reflections light the model. */
  environment: number;
  exposure: number;
  /** A sky-and-ground light, for outdoor looks. */
  hemisphere?: { sky: number; ground: number; intensity: number };
  lights: readonly DirectionalLightSetting[];
}

export const lightPresets: Record<LightPresetName, LightPreset> = {
  studio: {
    environment: 0.85,
    exposure: 1,
    lights: [
      { colour: 0xffffff, intensity: 1.6, position: [3, 4, 5] },
      { colour: 0xffffff, intensity: 0.5, position: [-4, 2, -2] },
    ],
  },
  daylight: {
    environment: 0.35,
    exposure: 1,
    hemisphere: { sky: 0xcfe3ff, ground: 0xb89a74, intensity: 1.4 },
    lights: [{ colour: 0xffe8c2, intensity: 2.2, position: [6, 9, 2] }],
  },
  dramatic: {
    environment: 0.12,
    exposure: 0.95,
    lights: [
      { colour: 0xffffff, intensity: 4, position: [-6, 3, 2] },
      { colour: 0xffd8a8, intensity: 2, position: [4, 2, -6] },
    ],
  },
  night: {
    environment: 0.2,
    exposure: 0.9,
    hemisphere: { sky: 0x2a3a78, ground: 0x0b0d18, intensity: 0.8 },
    lights: [
      { colour: 0x9fb7ff, intensity: 1.6, position: [-3, 4, 4] },
      { colour: 0xffb070, intensity: 1.2, position: [4, -1, 3] },
    ],
  },
};

export function findLightPreset(name: string): LightPreset {
  return lightPresets[
    (lightPresetNames as readonly string[]).includes(name) ? (name as LightPresetName) : "studio"
  ];
}
