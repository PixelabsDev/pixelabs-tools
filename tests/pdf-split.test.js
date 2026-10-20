const assert = require('assert');
const { JSDOM } = require('jsdom');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

describe('PDF Split Error Path', function() {
  it('should display error toast when PDFLib.PDFDocument.load fails', async function() {
    const html = `<!DOCTYPE html><html><body>
      <div id="dropzone"></div><div id="editor" class="hidden"></div>
      <div id="doc-info"></div><select id="mode"></select><div id="range-wrap"></div>
      <input id="range"><button id="run-btn"></button><button id="clear-btn"></button>
      <div id="msg"></div><select id="proc"></select><p id="proc-note"></p>
      <div id="toast-root"></div>
    </body></html>`;
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    const win = dom.window;

    // Define globals used by pdf-split.js
    win.toast = sinon.spy();
    win.makeDropzone = sinon.spy();
    win.escapeHtml = (s) => s;
    win.formatBytes = (b) => b;
    win.showMsg = sinon.spy();
    win.CloudTools = { trackProcessing: sinon.spy() };

    // Set up the mock for PDFLib.PDFDocument.load
    win.PDFLib = {
      PDFDocument: {
        load: sinon.stub().rejects(new Error("password protected or corrupted."))
      }
    };
    win.readFileAsArrayBuffer = sinon.stub().resolves(new ArrayBuffer(8));

    // Read the script content
    const code = fs.readFileSync(path.join(__dirname, '../assets/js/tools/pdf-split.js'), 'utf-8');

    // We expose the load function to window so we can trigger it
    const exposedCode = code.replace(
      'function load(file) {',
      'window.triggerLoad = load; function load(file) {'
    );

    const script = win.document.createElement('script');
    script.textContent = exposedCode;
    win.document.body.appendChild(script);

    // Call load with a dummy file
    const fakeFile = { type: 'application/pdf', name: 'test.pdf', size: 100 };
    win.triggerLoad(fakeFile);

    // Wait for async promises to settle
    await new Promise(r => setTimeout(r, 50));

    // Verify error path
    assert.ok(win.toast.called, 'toast should have been called');
    assert.strictEqual(
      win.toast.args[0][0],
      "Could not read that PDF: password protected or corrupted.",
      "Toast message should match the error"
    );
    assert.strictEqual(win.toast.args[0][1], "err");
  });
});
