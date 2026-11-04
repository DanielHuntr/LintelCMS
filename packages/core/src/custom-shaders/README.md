# custom-shaders

The site's own shaders: fragment shaders a developer pastes into the code box in the page
builder and saves to use anywhere on the site. See decision 0066 and the docs page "Custom
shaders".

- `custom-shaders.routes.ts`: `GET`, `PUT` and `DELETE /website/shaders`, for the site being
  edited. Seeing and using them takes `builder:design`; writing them takes `builder:design`
  and `builder:code`.
- `custom-shaders.service.ts`: reading, checking and saving, and `readShadersForPages`, the
  code pages get. Nothing can be saved, and no page gets any code, unless the site's
  `builderCustomScripts` setting is `allowScripts`. Code is checked with `readCustomShader`
  from `@lintel/motion/effects`, the same check the code box and the page run.
- `custom-shaders.repository.ts`: one `customShaders:<site id>` row per site in the settings
  table, so no migration.

Pages name a shader by id in a layer (`{ effect: "custom-shader", shader: "<id>" }`). The
page's `lintel-effects` list carries the code of only the shaders that page uses, written
with `scriptSafeJson`. Saving clears the rendered pages, like any write.
