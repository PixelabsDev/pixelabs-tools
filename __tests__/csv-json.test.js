const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const Papa = require('papaparse');

describe('CSV ↔ JSON Converter', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Setup DOM
    dom = new JSDOM(`
      <html>
        <body>
          <textarea id="csv-in"></textarea>
          <button id="to-json-btn"></button>
          <textarea id="json-out"></textarea>
          <div id="json-out-wrap" class="hidden"></div>
          <button id="copy-json-btn"></button>
          <button id="dl-json-btn"></button>
          <div id="msg1"></div>

          <textarea id="json-in"></textarea>
          <button id="to-csv-btn"></button>
          <textarea id="csv-out"></textarea>
          <div id="csv-out-wrap" class="hidden"></div>
          <button id="copy-csv-btn"></button>
          <button id="dl-csv-btn"></button>
          <div id="msg2"></div>
        </body>
      </html>
    `, { runScripts: "dangerously" });

    document = dom.window.document;
    window = dom.window;

    // Provide Papa to window
    window.Papa = Papa;

    // Mock global missingLib and toast if they are called
    window.missingLib = jest.fn();
    window.toast = jest.fn();
    window.downloadBlob = jest.fn();

    // Load the script
    const scriptContent = fs.readFileSync(path.resolve(__dirname, '../assets/js/tools/csv-json.js'), 'utf-8');
    const scriptEl = document.createElement('script');
    scriptEl.textContent = scriptContent;
    document.body.appendChild(scriptEl);
  });

  test('converts CSV to JSON correctly', () => {
    const csvIn = document.getElementById('csv-in');
    const toJsonBtn = document.getElementById('to-json-btn');
    const jsonOut = document.getElementById('json-out');
    const msg1 = document.getElementById('msg1');
    const jsonOutWrap = document.getElementById('json-out-wrap');

    csvIn.value = 'name,age\nAlice,30\nBob,25';

    // Trigger conversion
    toJsonBtn.dispatchEvent(new window.MouseEvent('click'));

    expect(jsonOutWrap.classList.contains('hidden')).toBe(false);

    const outputData = JSON.parse(jsonOut.value);
    expect(outputData).toHaveLength(2);
    expect(outputData[0].name).toBe('Alice');
    expect(outputData[0].age).toBe(30);
    expect(outputData[1].name).toBe('Bob');
    expect(outputData[1].age).toBe(25);

    expect(msg1.textContent).toContain('Converted 2 row(s) to JSON.');
    expect(msg1.className).toContain('ok');
  });

  test('handles empty CSV input', () => {
    const csvIn = document.getElementById('csv-in');
    const toJsonBtn = document.getElementById('to-json-btn');
    const msg1 = document.getElementById('msg1');

    csvIn.value = '   ';
    toJsonBtn.dispatchEvent(new window.MouseEvent('click'));

    expect(msg1.textContent).toBe('Paste some CSV (or drop a .csv file) first.');
    expect(msg1.className).toContain('err');
  });

  test('handles invalid CSV parsing', () => {
    const csvIn = document.getElementById('csv-in');
    const toJsonBtn = document.getElementById('to-json-btn');
    const msg1 = document.getElementById('msg1');

    csvIn.value = 'invalid,csv"data';

    // Mock Papa.parse to throw an error for this specific test
    const originalParse = window.Papa.parse;
    window.Papa.parse = jest.fn(() => {
      throw new Error('Parse error');
    });

    toJsonBtn.dispatchEvent(new window.MouseEvent('click'));

    expect(msg1.textContent).toBe('Could not parse this CSV.');
    expect(msg1.className).toContain('err');

    window.Papa.parse = originalParse;
  });

  test('converts JSON to CSV correctly', () => {
    const jsonIn = document.getElementById('json-in');
    const toCsvBtn = document.getElementById('to-csv-btn');
    const csvOut = document.getElementById('csv-out');
    const msg2 = document.getElementById('msg2');
    const csvOutWrap = document.getElementById('csv-out-wrap');

    jsonIn.value = JSON.stringify([{name: "Alice", age: 30}, {name: "Bob", age: 25}]);

    toCsvBtn.dispatchEvent(new window.MouseEvent('click'));

    expect(csvOutWrap.classList.contains('hidden')).toBe(false);

    const outputCsv = csvOut.value;
    expect(outputCsv).toContain('name,age');
    expect(outputCsv).toContain('Alice,30');
    expect(outputCsv).toContain('Bob,25');

    expect(msg2.textContent).toContain('Converted 2 record(s) to CSV.');
    expect(msg2.className).toContain('ok');
  });

  test('handles empty JSON input', () => {
    const jsonIn = document.getElementById('json-in');
    const toCsvBtn = document.getElementById('to-csv-btn');
    const msg2 = document.getElementById('msg2');

    jsonIn.value = '   ';
    toCsvBtn.dispatchEvent(new window.MouseEvent('click'));

    expect(msg2.textContent).toBe('Paste some JSON first.');
    expect(msg2.className).toContain('err');
  });

  test('handles invalid JSON input', () => {
    const jsonIn = document.getElementById('json-in');
    const toCsvBtn = document.getElementById('to-csv-btn');
    const msg2 = document.getElementById('msg2');

    jsonIn.value = '{ invalid_json ]';

    toCsvBtn.dispatchEvent(new window.MouseEvent('click'));

    expect(msg2.textContent).toContain('Invalid JSON:');
    expect(msg2.className).toContain('err');
  });

  test('handles single JSON object (not array)', () => {
    const jsonIn = document.getElementById('json-in');
    const toCsvBtn = document.getElementById('to-csv-btn');
    const csvOut = document.getElementById('csv-out');

    jsonIn.value = JSON.stringify({name: "Alice", age: 30});

    toCsvBtn.dispatchEvent(new window.MouseEvent('click'));

    const outputCsv = csvOut.value;
    expect(outputCsv).toContain('name,age');
    expect(outputCsv).toContain('Alice,30');
  });
});
