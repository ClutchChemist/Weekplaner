export function uid(): string {
  return crypto.randomUUID();
}

export function randomId(prefix = ""): string {
  return `${prefix}${uid()}`;
}
