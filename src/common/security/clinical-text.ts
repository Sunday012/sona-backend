const CRISIS_PATTERNS = [
  /\bkill myself\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend my life\b/i,
  /\bself[- ]?harm\b/i,
  /\bhurt myself\b/i,
  /\bimmediate danger\b/i,
];

export function containsCrisisLanguage(value: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(value));
}

export function scrubDirectIdentifiers(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[phone removed]')
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/\B@[a-z0-9_]{2,30}\b/gi, '[handle removed]')
    .trim();
}
