const { escapeHtml } = require('../assets/js/common.js');

describe('escapeHtml', () => {
  it('should return empty string for falsy values', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(false)).toBe('false');
    expect(escapeHtml(0)).toBe('0');
  });

  it('should escape &', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('should escape < and >', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('should escape "', () => {
    expect(escapeHtml('class="test"')).toBe('class=&quot;test&quot;');
  });

  it('should escape \'', () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it('should escape multiple occurrences', () => {
    expect(escapeHtml('<a href="x&y">it\'s</a>')).toBe('&lt;a href=&quot;x&amp;y&quot;&gt;it&#039;s&lt;/a&gt;');
  });
});
