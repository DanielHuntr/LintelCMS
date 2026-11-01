# Interface languages

The language of the admin's own words: menus, buttons and messages. Not the language of
the site's content, which is `src/sites/locales`.

The admin shows, in order of preference:

1. the language the signed-in person chose (the `user_interface_languages` table),
2. the site's default, chosen in Settings → Interface language (the
   `defaultInterfaceLanguage` setting),
3. the deployment's, from `LINTEL_DEFAULT_INTERFACE_LANGUAGE` or `interfaceLanguage` in
   `lintel.config.json` (`deployment-interface-language.ts`),
4. English.

The API only checks a choice is a well-formed language tag. Which languages have words is
up to the admin (`packages/admin/src/i18n`), which falls back to English for any it lacks.

| File                                | What it does                                     |
| ----------------------------------- | ------------------------------------------------ |
| `interface-languages.table.ts`      | Each person's choice                             |
| `interface-languages.schema.ts`     | Language tags, requests and the response         |
| `interface-languages.routes.ts`     | `GET`/`PUT /interface-language`, `/site-default` |
| `interface-languages.service.ts`    | Works out which language applies                 |
| `interface-languages.repository.ts` | Database reads and writes                        |
| `deployment-interface-language.ts`  | The deployment's default                         |
