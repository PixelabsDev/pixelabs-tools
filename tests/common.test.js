const { escapeHtml, baseName } = require('../assets/js/common.js');

describe('escapeHtml', () => {
  it('returns empty string for nullish values and stringifies other falsy values', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(false)).toBe('false');
    expect(escapeHtml(0)).toBe('0');
  });
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<a href="x&y">it\'s</a>')).toBe('&lt;a href=&quot;x&amp;y&quot;&gt;it&#039;s&lt;/a&gt;');
  });
});

describe('baseName', () => {
  test.each([
    ['file.txt', 'file'],
    ['archive.tar.gz', 'archive.tar'],
    ['file', 'file'],
    ['.gitignore', '.gitignore'],
    ['/path/to/file.txt', 'file'],
    ['path/to/file.txt', 'file'],
    ['/path/to/file', 'file'],
    ['C:\\path\\to\\file.txt', 'file'],
  ])('returns the filename without its final extension for %s', (input, expected) => {
    expect(baseName(input)).toBe(expected);
  });
});
