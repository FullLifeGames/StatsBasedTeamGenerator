export function toId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function displayName(id: string, names: Record<string, string>): string {
  return names[id] ?? id;
}
