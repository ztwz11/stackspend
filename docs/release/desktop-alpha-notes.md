# MoneySiren Desktop Alpha

This prerelease publishes source-free alpha artifacts for local review:

- `moneysiren-web-runtime-*.tar.gz`: built Next.js dashboard runtime.
- Windows desktop portable executable: runnable Tauri `.exe` for `msiren hud`.
- Windows desktop installer: Tauri NSIS `.exe` for manual installation.
- macOS desktop app archive: Tauri `.app` in `.tar.gz`.
- SHA256 checksum files for the release assets.

## Install Order

1. Install the CLI from npm:

   ```bash
   npm install -g @moneysiren/cli@alpha
   ```

2. Install the source-free dashboard and HUD release assets:

   ```bash
   msiren install --all
   ```

3. Start the local dashboard or HUD:

   ```bash
   msiren start
   msiren hud
   ```

The desktop shell opens the local dashboard and HUD at `http://127.0.0.1:3000`. In this alpha, the native desktop app does not yet embed or auto-start the web runtime.

## Security Notes

- Desktop artifacts are code signed when the release workflow has the required signing secrets.
- If Windows signing secrets are not configured, the Windows prerelease artifact is an unsigned alpha build. Treat it as a local review build until signed assets are published.
- macOS desktop artifacts require Apple signing secrets in CI and may be absent from unsigned alpha releases.
- Do not create `.env` files with live credentials.
- Use process-local environment variables for live provider sync.
- Provider connectors remain read-only.
- Telemetry is off by default.
