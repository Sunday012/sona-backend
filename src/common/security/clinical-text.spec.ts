import { describe, expect, it } from 'vitest';
import { containsCrisisLanguage, scrubDirectIdentifiers } from './clinical-text.js';

describe('clinical text safety', () => {
  it('removes common direct identifiers before intake text is persisted', () => {
    const result = scrubDirectIdentifiers('Reach me at person@example.com or +234 801 234 5678 @private');
    expect(result).not.toContain('person@example.com');
    expect(result).not.toContain('801 234');
    expect(result).not.toContain('@private');
  });

  it('flags explicit crisis language', () => {
    expect(containsCrisisLanguage('I want to hurt myself')).toBe(true);
    expect(containsCrisisLanguage('I am stressed about an exam')).toBe(false);
  });
});
