# MoneySiren App

One-command alpha installer for MoneySiren.

This package bundles the MoneySiren CLI entrypoints and, on global npm installs, runs `msiren install --all` to download the local web dashboard runtime and HUD desktop artifacts from the matching GitHub Release.

## Install

```bash
npm install -g @moneysiren/app@alpha
msiren start
msiren hud
```

The package installs both commands:

- `moneysiren`
- `msiren`

## What It Installs

- CLI command surface.
- Local web dashboard runtime.
- HUD desktop artifact.

The Web/HUD artifacts are verified against published SHA256 checksums. Alpha Windows HUD artifacts may be unsigned until release signing is fully configured.

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
