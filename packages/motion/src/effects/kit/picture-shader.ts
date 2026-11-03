import { fitPicture, readObjectPosition, type PictureFit } from "../maths/picture-fit.js";
import { readableCopy } from "./loaded.js";
import type { ShaderRenderer, ShaderTexture, UniformValue } from "./shader-renderer.js";

/**
 * Pictures in shaders, placed the way the page places them (object-fit, object-position),
 * so an effect drawn over a picture lines up with it exactly.
 */

/** Where the picture sits in its box, in the shader's terms: `q` part of it, `g` where. */
export const pictureLookup = `uniform sampler2D s;uniform vec4 q,g;
vec4 pic(vec2 p){vec2 l=(p-g.xy)/g.zw;if(l.x<0.||l.y<0.||l.x>1.||l.y>1.)return vec4(0.);return texture2D(s,q.xy+l*q.zw);}
vec4 edge(vec2 p){return texture2D(s,q.xy+clamp((p-g.xy)/g.zw,0.,1.)*q.zw);}`;

/** The picture's `object-fit` and `object-position`, as the effects draw it. */
export function fitOf(image: HTMLImageElement) {
  const style = getComputedStyle(image);
  return fitPicture(
    { width: image.naturalWidth, height: image.naturalHeight },
    { width: image.offsetWidth, height: image.offsetHeight },
    style.objectFit as PictureFit,
    readObjectPosition(style.objectPosition),
  );
}

/** The `q` and `g` uniforms: the part of the picture shown, and where, upside down for GL. */
export function placementUniforms(image: HTMLImageElement): Record<string, UniformValue> {
  const { source, target } = fitOf(image);
  const across = image.naturalWidth || 1;
  const down = image.naturalHeight || 1;
  const width = image.offsetWidth || 1;
  const height = image.offsetHeight || 1;
  return {
    q: [
      source.x / across,
      1 - (source.y + source.height) / down,
      source.width / across,
      source.height / down,
    ],
    g: [
      target.x / width,
      1 - (target.y + target.height) / height,
      target.width / width,
      target.height / height,
    ],
  };
}

/** The picture as a texture, from a copy fetched with permission if the page can't read it. */
export async function pictureTexture(
  renderer: ShaderRenderer,
  image: HTMLImageElement,
): Promise<ShaderTexture | undefined> {
  const texture = renderer.texture(image);
  if (texture) return texture;
  const copy = await readableCopy(image);
  return copy ? renderer.texture(copy) : undefined;
}
