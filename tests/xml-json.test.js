const fs = require('fs');
const xmlJsonJs = fs.readFileSync('./assets/js/tools/xml-json.js', 'utf8');

describe('XML parser', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <textarea id="xml-in"></textarea>
      <button id="x2j-btn"></button>
      <textarea id="x2j-out"></textarea>
      <div id="x2j-wrap"></div>
      <button id="copy-x2j-btn"></button>
      <button id="dl-x2j-btn"></button>
      <div id="msg1"></div>
      <textarea id="json-in"></textarea>
      <button id="j2x-btn"></button>
      <textarea id="j2x-out"></textarea>
      <div id="j2x-wrap"></div>
      <button id="copy-j2x-btn"></button>
      <button id="dl-j2x-btn"></button>
      <div id="msg2"></div>`;
    global.toast = jest.fn();
    global.downloadBlob = jest.fn();
    eval(xmlJsonJs);
  });

  test('rejects a DOCTYPE that follows an XML declaration', () => {
    document.getElementById('xml-in').value =
      '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY x "expanded">]><root>&x;</root>';
    document.getElementById('x2j-btn').click();
    expect(document.getElementById('msg1').textContent)
      .toBe('DOCTYPE and custom entities are not supported.');
  });

  test('does not mistake a valid parsererror element for a parser failure', () => {
    document.getElementById('xml-in').value =
      '<root><parsererror>ordinary XML content</parsererror><child>ok</child></root>';
    document.getElementById('x2j-btn').click();
    expect(JSON.parse(document.getElementById('x2j-out').value)).toEqual({
      root: { parsererror: 'ordinary XML content', child: 'ok' }
    });
  });

  test('rejects malformed XML', () => {
    document.getElementById('xml-in').value = '<root><child></root>';
    document.getElementById('x2j-btn').click();
    expect(document.getElementById('msg1').textContent).toMatch(/^Invalid XML/);
  });

  test('keeps markup-like text as inert textarea data', () => {
    document.getElementById('xml-in').value = '<root>&lt;img src=x onerror=alert(1)&gt;</root>';
    document.getElementById('x2j-btn').click();
    expect(document.getElementById('x2j-out').value).toContain('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });
});
