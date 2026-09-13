function segmentsOf(path: string): string[] {
  return path
    .replace(/^\$\.?/, '')
    .split('.')
    .filter(Boolean);
}

export function getByPath(
  source: Record<string, unknown>,
  path: string,
): unknown {
  return segmentsOf(path).reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = segmentsOf(path);
  let cursor = target;
  segments.forEach((key, index) => {
    if (index === segments.length - 1) {
      cursor[key] = value;
      return;
    }
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  });
}
