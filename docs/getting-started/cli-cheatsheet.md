# CLI Cheatsheet

Quick reference for `slidev-workspace` commands, flags, and common workflows.

## Basics

```bash
slidev-workspace <command> [options]
```

## Commands

### Development

```bash
# Start the workspace preview app (alias: preview)
slidev-workspace preview

# Start preview on a custom port
slidev-workspace preview --port 3030
```

### Build

```bash
# Build preview app + all slides
slidev-workspace build

# Build specific slides by name (comma-separated)
slidev-workspace build slide1,slide2

# Build specific slides by name (space-separated)
slidev-workspace build slide1 slide2
```

### Export OG Images

```bash
# Export OG images for all slides
slidev-workspace export-og
```

### Help

```bash
slidev-workspace help
```

## Tips

- `build` accepts either comma-separated or space-separated slide names.
- For CI, run `slidev-workspace build` to produce the preview app and slide assets in `outputDir`.
