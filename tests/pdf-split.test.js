const fs = require('fs');
const path = require('path');

test('shows an error toast when PDF loading rejects a corrupt or protected file', async () => {
  document.body.innerHTML = `
    <div id="dropzone"></div><div id="editor" class="hidden"></div><div id="doc-info"></div>
    <select id="mode"></select><div id="range-wrap"></div><input id="range">
    <button id="run-btn"></button><button id="clear-btn"></button><div id="msg"></div>
    <select id="proc"></select><p id="proc-note"></p><div id="toast-root"></div>`;

  const toast = jest.fn();
  window.toast = toast;
  window.makeDropzone = jest.fn();
  window.escapeHtml = value => value;
  window.formatBytes = value => value;
  window.showMsg = jest.fn();
  window.CloudTools = { trackProcessing: jest.fn() };
  window.readFileAsArrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
  window.PDFLib = {
    PDFDocument: { load: jest.fn().mockRejectedValue(new Error('password protected or corrupted.')) }
  };

  const source = fs.readFileSync(path.join(__dirname, '../assets/js/tools/pdf-split.js'), 'utf8');
  const exposedSource = source.replace('function load(file) {', 'window.triggerLoad = load; function load(file) {');
  window.eval(exposedSource);
  window.triggerLoad({ type: 'application/pdf', name: 'test.pdf', size: 100 });
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(toast).toHaveBeenCalledWith(
    'Could not read that PDF: password protected or corrupted.',
    'err'
  );
});
