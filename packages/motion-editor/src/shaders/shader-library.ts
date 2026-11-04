import { createContext, useContext } from "react";

/**
 * The site's own shaders, as the host app hands them to the Motion panel. Left out, the panel
 * offers no custom shaders. Anyone who can design a page can use one; writing them takes
 * `canWrite` (design and code permissions) and `allowed` (the site allows custom code).
 */

export interface ShaderInLibrary {
  id: string;
  name: string;
  code: string;
}

export interface ShaderLibrary {
  shaders: readonly ShaderInLibrary[];
  allowed: boolean;
  canWrite: boolean;
  /** Resolves with what's wrong in the server's words, or undefined once it is saved. */
  save(shader: ShaderInLibrary): Promise<string | undefined>;
  remove(id: string): void;
  /** Lets the site use custom code, for people who manage its settings. */
  allowCode?: () => void;
}

export const ShaderLibraryContext = createContext<ShaderLibrary | undefined>(undefined);

export const useShaderLibrary = () => useContext(ShaderLibraryContext);

/** The code box's first text: a small working shader that shows every kind of control. */
export const starterShader = `// @name Soft rings
// @fallback #101820

uniform float rings;  // @slider "How many rings" min=1 max=20 step=1 value=8
uniform vec3 tint;    // @colour "Ring colour" value=#e8743b
uniform bool flip;    // @toggle "Turn inside out" value=off

void main() {
  vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  float wave = 0.5 + 0.5 * sin(length(p) * rings * 6.28 - time);
  if (flip) wave = 1.0 - wave;
  gl_FragColor = vec4(tint * wave, 1.0);
}
`;
