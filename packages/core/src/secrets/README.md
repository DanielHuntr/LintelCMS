# Secrets

Passwords and keys Lintel has to use later but never shows again, such as the password of
the FTP account a website is published to. `secret-box.ts` seals them with AES-256-GCM
before they are saved and opens them only when they are needed.

The key is never stored in the database:

- `LINTEL_SECRET_KEY` (64 hexadecimal characters) when it is set. Set it on servers whose
  `.lintel` folder isn't kept between deploys, such as containers.
- Otherwise `.lintel/secret.key`, made on first use, readable only by its owner.

Losing the key means saved passwords have to be typed again; nothing else is lost. API
responses only ever say whether a secret is saved (`hasPassword: true`), never what it is.

| File                 | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `secret-box.ts`      | `createSecretBox(key)`, `loadSecretKey(folder)` |
| `secret-box.test.ts` | Round trips, tampering and the key file         |
