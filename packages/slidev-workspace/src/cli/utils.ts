export function parsePortOption(value: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

export function setWorkspaceCwd() {
  // Don't override if already set (e.g. via Docker entrypoint env var)
  if (!process.env.SLIDEV_WORKSPACE_CWD) {
    process.env.SLIDEV_WORKSPACE_CWD = process.cwd();
  }
}

export function parseNames(names?: string[]) {
  if (!names || names.length === 0) return undefined;
  const parsed = names
    .flatMap((name) => name.split(","))
    .map((name) => name.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
}
