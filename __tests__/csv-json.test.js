const { JSDOM } = require('jsdom');
const fs = require('fs');
const Papa = require('papaparse');

const html = fs.readFileSync('./tools/csv-json.html', 'utf8');
const csvJsonJs = fs.readFileSync('./assets/js/tools/csv-json.js', 'utf8');

describe('CSV ↔ JSON Converter', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    dom = new JSDOM(html, { runScripts: 'dangerously' });
    window = dom.window;
    document = window.document;

    // Polyfill dependencies for the script
    window.Papa = Papa;
    window.toast = jest.fn();
    window.downloadBlob = jest.fn();

    // Mock navigator.clipboard
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue()
      },
      writable: true
    });

    // Mock missingLib
    window.missingLib = jest.fn();

    // Polyfill URL.createObjectURL for blob
    window.URL.createObjectURL = jest.fn();

    const scriptEl2 = document.createElement('script');
    scriptEl2.textContent = csvJsonJs;
    document.body.appendChild(scriptEl2);
  });

  describe('CSV -> JSON', () => {
    test('converts valid CSV to JSON array', () => {
      const csvIn = document.getElementById('csv-in');
      const toJsonBtn = document.getElementById('to-json-btn');
      const jsonOut = document.getElementById('json-out');
      const msg1 = document.getElementById('msg1');

      csvIn.value = 'name,age\nAlice,30\nBob,25';
      toJsonBtn.click();

      const expectedJson = JSON.stringify([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }], null, 2);
      expect(jsonOut.value).toBe(expectedJson);
      expect(msg1.textContent).toBe('Converted 2 row(s) to JSON.');
      expect(msg1.className).toBe('msg ok');
      expect(document.getElementById('json-out-wrap').classList.contains('hidden')).toBe(false);
    });

    test('handles empty CSV input', () => {
      const csvIn = document.getElementById('csv-in');
      const toJsonBtn = document.getElementById('to-json-btn');
      const msg1 = document.getElementById('msg1');

      csvIn.value = '   ';
      toJsonBtn.click();

      expect(msg1.textContent).toBe('Paste some CSV (or drop a .csv file) first.');
      expect(msg1.className).toBe('msg err');
    });

    test('handles PapaParse errors gracefully', () => {
      const csvIn = document.getElementById('csv-in');
      const toJsonBtn = document.getElementById('to-json-btn');
      const msg1 = document.getElementById('msg1');

      const originalParse = window.Papa.parse;
      window.Papa.parse = jest.fn().mockReturnValue({
        data: [],
        errors: [{ message: 'Mock parse error' }]
      });

      csvIn.value = 'invalid,csv,here';
      toJsonBtn.click();

      expect(msg1.textContent).toBe('Could not parse this CSV: Mock parse error');
      expect(msg1.className).toBe('msg err');

      window.Papa.parse = originalParse;
    });

    test('handles exceptions during CSV to JSON conversion', () => {
      const csvIn = document.getElementById('csv-in');
      const toJsonBtn = document.getElementById('to-json-btn');
      const msg1 = document.getElementById('msg1');

      const originalParse = window.Papa.parse;
      window.Papa.parse = () => { throw new Error('Unexpected error'); };

      csvIn.value = 'name,age\nAlice,30';
      toJsonBtn.click();

      expect(msg1.textContent).toBe('Could not parse this CSV.');
      expect(msg1.className).toBe('msg err');

      window.Papa.parse = originalParse;
    });
  });

  describe('JSON -> CSV', () => {
    test('converts valid JSON array to CSV', () => {
      const jsonIn = document.getElementById('json-in');
      const toCsvBtn = document.getElementById('to-csv-btn');
      const csvOut = document.getElementById('csv-out');
      const msg2 = document.getElementById('msg2');

      jsonIn.value = JSON.stringify([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
      toCsvBtn.click();

      const expectedCsv = 'name,age\nAlice,30\nBob,25';
      // Papa.unparse defaults to \r\n on some platforms but papa in jest might be \n or \r\n, let's normalize
      expect(csvOut.value.replace(/\r\n/g, '\n')).toBe(expectedCsv);
      expect(msg2.textContent).toBe('Converted 2 record(s) to CSV.');
      expect(msg2.className).toBe('msg ok');
      expect(document.getElementById('csv-out-wrap').classList.contains('hidden')).toBe(false);
    });

    test('converts single JSON object to CSV', () => {
      const jsonIn = document.getElementById('json-in');
      const toCsvBtn = document.getElementById('to-csv-btn');
      const csvOut = document.getElementById('csv-out');
      const msg2 = document.getElementById('msg2');

      jsonIn.value = JSON.stringify({ name: 'Alice', age: 30 });
      toCsvBtn.click();

      const expectedCsv = 'name,age\nAlice,30';
      expect(csvOut.value.replace(/\r\n/g, '\n')).toBe(expectedCsv);
      expect(msg2.textContent).toBe('Converted 1 record(s) to CSV.');
    });

    test('handles empty JSON input', () => {
      const jsonIn = document.getElementById('json-in');
      const toCsvBtn = document.getElementById('to-csv-btn');
      const msg2 = document.getElementById('msg2');

      jsonIn.value = '   ';
      toCsvBtn.click();

      expect(msg2.textContent).toBe('Paste some JSON first.');
      expect(msg2.className).toBe('msg err');
    });

    test('handles invalid JSON input syntax', () => {
      const jsonIn = document.getElementById('json-in');
      const toCsvBtn = document.getElementById('to-csv-btn');
      const msg2 = document.getElementById('msg2');

      jsonIn.value = 'not valid json';
      toCsvBtn.click();

      expect(msg2.textContent).toMatch(/Invalid JSON:/);
      expect(msg2.className).toBe('msg err');
    });
  });
});
