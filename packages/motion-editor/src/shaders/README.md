# shaders

The Motion panel's shader tools. See decision 0066 and the docs page "Custom shaders".

| File                | What it does                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ShaderLayers.tsx`  | A section's background as layers, top layer first: hide, reorder, blend, opacity, remove, add                |
| `ReactControl.tsx`  | A quiet button beside a number setting that lets the pointer, scrolling or a timeline drive it               |
| `ShaderCodeBox.tsx` | Where a developer writes a shader: the code, a live preview, messages naming the line, and the controls      |
| `shader-library.ts` | The site's shaders as the host app hands them over (`ShaderLibraryContext`), and the code box's starter code |

The host app provides `ShaderLibraryContext`; the admin's is `useShaderLibraryForBuilder`.
Left out, the panel offers no custom shaders. `canWrite` is for the code permission and
`allowed` is the site's custom code setting. The server checks both again.

The preview comes from `@lintel/motion/shader-preview`, which has a WebGL context of its own.
Code the graphics card stopped isn't tried again until it has changed, and can't be saved.

While `allowed` is false the panel sends no shader code to the canvas, the same as a published
page.
