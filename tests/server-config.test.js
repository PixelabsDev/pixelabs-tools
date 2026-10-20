/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Server Config Generator - Error Handling', () => {
  let els;
  let toastMsg;

  beforeEach(() => {
    // Reset global state
    toastMsg = null;
    window.toast = (msg) => { toastMsg = msg; };
    global.toast = window.toast;

    // Set up basic DOM required by the script
    document.body.innerHTML = `
      <div>
        <input type="text" id="domain">
        <select id="server">
          <option value="nginx">Nginx</option>
          <option value="apache">Apache</option>
        </select>
        <select id="www">
          <option value="none">none</option>
        </select>
        <div id="redirects"></div>
        <button id="add-btn"></button>
        <input type="checkbox" id="opt-https">
        <input type="checkbox" id="opt-gzip">
        <input type="checkbox" id="opt-cache">
        <input type="checkbox" id="opt-headers">
        <button id="gen-btn"></button>
        <div id="out-panel" class="hidden"></div>
        <div id="out-title"></div>
        <textarea id="out"></textarea>
        <button id="copy-btn"></button>
        <button id="dl-btn"></button>
      </div>
    `;

    // Stub layout methods not supported by JSDOM
    document.getElementById('out-panel').scrollIntoView = jest.fn();

    // Load and execute the script
    const scriptPath = path.resolve(__dirname, '../assets/js/tools/server-config.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Evaluate the script in the current context
    eval(scriptContent);

    els = {
      domain: document.getElementById('domain'),
      server: document.getElementById('server'),
      www: document.getElementById('www'),
      redirects: document.getElementById('redirects'),
      gen: document.getElementById('gen-btn')
    };
  });

  it('should show an error toast when domain contains a username or port', () => {
    els.domain.value = 'user@example.com';
    els.gen.click();
    expect(toastMsg).toBe('Enter a domain name without a username or port.');
  });

  it('should show an error toast for invalid domain that fails URL parsing', () => {
    els.domain.value = 'a b.com';
    els.gen.click();
    expect(toastMsg).toBe('Enter a valid domain name.');
  });
});
