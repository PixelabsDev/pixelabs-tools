const fs = require('fs');
const Papa = require('papaparse');
const source = fs.readFileSync('./assets/js/tools/csv-json.js', 'utf8');

function mountConverter(papa = Papa) {
  document.body.innerHTML = `
    <textarea id="csv-in"></textarea><button id="to-json-btn"></button><textarea id="json-out"></textarea>
    <div id="json-out-wrap" class="hidden"></div><button id="copy-json-btn"></button><button id="dl-json-btn"></button><div id="msg1"></div>
    <textarea id="json-in"></textarea><button id="to-csv-btn"></button><textarea id="csv-out"></textarea>
    <div id="csv-out-wrap" class="hidden"></div><button id="copy-csv-btn"></button><button id="dl-csv-btn"></button><div id="msg2"></div>`;
  window.Papa = papa;
  window.toast = jest.fn();
  window.downloadBlob = jest.fn();
  window.missingLib = jest.fn();
  window.eval(source);
}

beforeEach(() => mountConverter());

test('copy actions report clipboard failures', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) }
  });
  document.getElementById('json-out').value = '[]';
  document.getElementById('copy-json-btn').click();
  await Promise.resolve();
  expect(window.toast).toHaveBeenCalledWith('Copy failed — select the text manually.', 'err');
});

test('copy actions handle unavailable clipboard', () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  document.getElementById('copy-csv-btn').click();
  expect(window.toast).toHaveBeenCalledWith('Copy not available — select the text manually.', 'err');
});

test('download actions create the expected file blobs and skip empty output', () => {
  const jsonOut = document.getElementById('json-out');
  jsonOut.value = '[1]';
  document.getElementById('dl-json-btn').click();
  expect(window.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'data.json');
  document.getElementById('dl-csv-btn').click();
  expect(window.downloadBlob).toHaveBeenCalledTimes(1);
});

test('CSV drop reads a file and dragover prevents browser navigation', () => {
  class Reader {
    readAsText() { this.result = 'name\nAda'; this.onload(); }
  }
  window.FileReader = Reader;
  const input = document.getElementById('csv-in');
  const drop = new Event('drop', { cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['name\nAda'], 'data.csv')] } });
  input.dispatchEvent(drop);
  expect(input.value).toBe('name\nAda');
  expect(drop.defaultPrevented).toBe(true);
  const dragover = new Event('dragover', { cancelable: true });
  input.dispatchEvent(dragover);
  expect(dragover.defaultPrevented).toBe(true);
});

test('missing PapaParse reports the missing library', () => {
  document.body.innerHTML = '<div></div>';
  window.Papa = undefined;
  window.eval(source);
  expect(window.missingLib).toHaveBeenCalledWith('PapaParse (run build.sh)');
});
