export function toId(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function displayName(id: string, names: Record<string, string>): string {
  return names[id] ?? id;
}
