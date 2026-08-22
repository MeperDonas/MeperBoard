# Self-hosting MeperBoard

MeperBoard is local-first and can run against a single GitHub repository with a
personal access token (PAT), without registering the hosted GitHub App. This is
the recommended setup for a private or air-gapped instance.

## Environment variables

| Variable | Mode | Purpose |
| --- | --- | --- |
| `AUTH_MODE` | `pat` | Use classic PAT authentication instead of the OAuth GitHub App flow. |
| `GITHUB_TOKEN` | `pat` | A personal access token with read access to the repositories you want to load. |
| `ALLOWED_ORIGIN` | both | The public URL of your instance. Localhost is allowed in development. |
| `AUTH_SECRET` | both | ≥ 32 characters. Used to derive the AES key that encrypts session cookies. |

> Set `AUTH_MODE=pat` to use a PAT. When `AUTH_MODE` is unset (default `oauth`),
> the app expects a GitHub App and will reject anonymous access to the read-only
> proxy.

## Steps

1. Set `AUTH_MODE=pat` in your environment.
2. Set `GITHUB_TOKEN` to a personal access token with read access to the
   repositories you want to load. Classic tokens work; fine-grained tokens with
   read-only **Issues** and **Contents** permissions are recommended.
3. Set `ALLOWED_ORIGIN` to your instance's public URL.
4. Build and run:

   ```bash
   npm run build
   npm start
   ```

5. The board loads the repository matching the token's owner and `DEFAULT_REPO`,
   or the repository you select once signed in.

## Security note

A personal access token grants broad access to the repositories it can reach.
Store it only in server-side environment variables and never expose it to the
browser. The hosted flow on meperboard.vercel.app uses a scoped GitHub App and
stores tokens in an HTTP-only cookie so they never reach client JavaScript —
prefer that flow for public or shared instances.
