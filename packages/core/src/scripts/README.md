# Scripts

Command-line tasks run with `pnpm --filter @lintel/core <name>`. Each script only reads
its input and calls a service, so the rules stay in the feature folders.

| Script            | Command        | What it does                                         |
| ----------------- | -------------- | ---------------------------------------------------- |
| `create-admin.ts` | `create-admin` | Creates a Super admin (role `["*"]`) to sign in with |

```bash
pnpm --filter @lintel/core create-admin --email ana@example.com --name "Ana Lopez"
```

The password is asked for without echoing it, or read from `LINTEL_ADMIN_PASSWORD` for
automated setups. It must be at least 12 characters. The script reads `DATABASE_URL`
from the environment or the root `.env` file.
