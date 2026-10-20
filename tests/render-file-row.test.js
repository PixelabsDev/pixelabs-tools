const { renderFileRow } = require('../assets/js/common.js');

describe('renderFileRow', () => {
  test('supports empty rows without a file or size text', () => {
    const row = renderFileRow(null, {
      thumb: false,
      nameHtml: '<span>Next run</span>',
      sizeHtml: ''
    });

    expect(row.querySelector('.name').textContent).toBe('Next run');
    expect(row.querySelector('.size').textContent).toBe('');
  });

  test('uses a provided thumbnail element instead of an empty image', () => {
    const icon = document.createElement('div');
    icon.className = 'thumb pdf';

    const row = renderFileRow(null, {
      thumbElement: icon,
      nameHtml: 'document.pdf',
      sizeHtml: '1 KB'
    });

    expect(row.querySelector('.thumb.pdf')).toBe(icon);
    expect(row.querySelector('img.thumb')).toBeNull();
  });

  test('escapes a file name when no custom HTML is provided', () => {
    const file = new File([], '<img src=x onerror=alert(1)>.txt');
    const row = renderFileRow(file, { thumb: false, sizeHtml: '' });

    expect(row.querySelector('.name').textContent).toBe(file.name);
    expect(row.querySelector('.name img')).toBeNull();
  });
});
