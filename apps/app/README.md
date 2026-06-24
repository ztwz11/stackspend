# MoneySiren App

One-command alpha installer for MoneySiren.

This is the recommended npm package for users who want all three local MoneySiren surfaces: CLI, web dashboard, and HUD. It bundles the MoneySiren CLI entrypoints and, on global npm installs, runs `msiren install --all` to download the local web dashboard runtime and HUD desktop artifacts from the matching GitHub Release.

## Install

```bash
npm install -g @moneysiren/app@alpha
msiren --version
msiren start
msiren hud
```

During alpha, keep `@alpha` in the install command. Stable releases will use the unqualified package name.

The package creates both global command shims during postinstall:

- `moneysiren`
- `msiren`

If npm reports `EEXIST` for `moneysiren` or `msiren`, an older alpha app package may still be installed. Remove the old global packages and reinstall:

```powershell
npm uninstall -g @moneysiren/cli @moneysiren/app
npm install -g @moneysiren/app@alpha --force
```

Current app packages do not use npm's `bin` field for these aliases, so stale MoneySiren-owned command shims can be replaced during postinstall without tripping npm's bin conflict check.

If Web/HUD asset download fails during postinstall, fix network or release access and rerun:

```bash
msiren install --all
msiren install --status
```

## What It Installs

- CLI command surface.
- Local web dashboard runtime.
- HUD desktop artifact.

The Web/HUD artifacts are verified against published SHA256 checksums. Alpha Windows HUD artifacts may be unsigned until release signing is fully configured.

For CLI-only automation, install `@moneysiren/cli@alpha` instead.

## Opt Out

To install only the package command and skip Web/HUD asset download:

```bash
MONEYSIREN_SKIP_APP_POSTINSTALL=1 npm install -g @moneysiren/app@alpha
msiren install --all
```

For local non-global package review, postinstall does not download release assets automatically. Run `msiren install --all` explicitly when needed.

## Stable Channel

During alpha, install with `@alpha`. Stable releases will use:

```bash
npm install -g @moneysiren/app
```
