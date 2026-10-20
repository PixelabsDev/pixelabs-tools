/* XML ↔ JSON Converter — DOMParser, fully local */
"use strict";

(function () {

  var els = {
    xmlIn: document.getElementById("xml-in"),
    x2j: document.getElementById("x2j-btn"),
    x2jOut: document.getElementById("x2j-out"),
    x2jWrap: document.getElementById("x2j-wrap"),
    copyX2j: document.getElementById("copy-x2j-btn"),
    dlX2j: document.getElementById("dl-x2j-btn"),
    msg1: document.getElementById("msg1"),
    jsonIn: document.getElementById("json-in"),
    j2x: document.getElementById("j2x-btn"),
    j2xOut: document.getElementById("j2x-out"),
    j2xWrap: document.getElementById("j2x-wrap"),
    copyJ2x: document.getElementById("copy-j2x-btn"),
    dlJ2x: document.getElementById("dl-j2x-btn"),
    msg2: document.getElementById("msg2")
  };

  function msg(el, text, kind) {
    el.textContent = text;
    el.className = "msg " + (kind || "info");
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { toast("Copy failed — select the text manually.", "err"); });
    } else {
      toast("Copy not available — select the text manually.", "err");
    }
  }

  [els.xmlIn, els.jsonIn].forEach(function (ta) {
    ta.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      var r = new FileReader();
      r.onload = function () { ta.value = r.result; };
      r.readAsText(f);
    });
    ta.addEventListener("dragover", function (e) { e.preventDefault(); });
  });

  /* ---------- XML -> JSON ---------- */
  function decodeXmlText(value) {
    var entities = /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/g;
    if (value.replace(entities, "").indexOf("&") !== -1) throw new Error("Unknown or incomplete XML entity.");
    return value.replace(entities, function (entity, body) {
      if (body === "amp") return "&";
      if (body === "lt") return "<";
      if (body === "gt") return ">";
      if (body === "quot") return '"';
      if (body === "apos") return "'";
      var code = body.slice(0, 2).toLowerCase() === "#x"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      var validXmlChar = code === 0x9 || code === 0xa || code === 0xd ||
        (code >= 0x20 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff);
      if (!validXmlChar) {
        throw new Error("Invalid XML character reference.");
      }
      return String.fromCodePoint(code);
    });
  }

  /* Build a plain data tree instead of asking the browser to reinterpret
     pasted text as a document. DTDs and custom entities are deliberately
     unsupported; they are not needed by the converter and can expand into
     unsafe or unbounded content. */
  function parseXml(source) {
    if (source.length > 2 * 1024 * 1024) throw new Error("XML is too large (2 MB maximum).");
    source = source.replace(/^\uFEFF/, "");
    var root = null;
    var stack = [];
    var pos = 0;

    function addText(text) {
      if (!stack.length) {
        if (text.trim()) throw new Error("Text outside the root element.");
        return;
      }
      if (text) stack[stack.length - 1].childNodes.push({ nodeType: 3, nodeValue: decodeXmlText(text) });
    }

    function findTagEnd(start) {
      var quote = "";
      for (var i = start; i < source.length; i++) {
        var ch = source.charAt(i);
        if (quote) {
          if (ch === quote) quote = "";
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === ">") {
          return i;
        }
      }
      throw new Error("Unclosed XML tag.");
    }

    function parseStartTag(body) {
      var match = /^([A-Za-z_:][A-Za-z0-9_.:-]*)/.exec(body);
      if (!match) throw new Error("Invalid XML element name.");
      var node = { nodeType: 1, nodeName: match[1], attributes: [], childNodes: [] };
      var attrs = Object.create(null);
      var i = match[0].length;
      while (i < body.length) {
        while (/\s/.test(body.charAt(i))) i++;
        if (i >= body.length) break;
        var attrMatch = /^([A-Za-z_:][A-Za-z0-9_.:-]*)/.exec(body.slice(i));
        if (!attrMatch) throw new Error("Invalid XML attribute.");
        var name = attrMatch[1];
        i += name.length;
        while (/\s/.test(body.charAt(i))) i++;
        if (body.charAt(i++) !== "=") throw new Error("XML attributes need a value.");
        while (/\s/.test(body.charAt(i))) i++;
        var quote = body.charAt(i++);
        if (quote !== '"' && quote !== "'") throw new Error("XML attribute values must be quoted.");
        var end = body.indexOf(quote, i);
        if (end === -1) throw new Error("Unclosed XML attribute value.");
        if (Object.prototype.hasOwnProperty.call(attrs, name)) throw new Error("Duplicate XML attribute.");
        var value = decodeXmlText(body.slice(i, end));
        attrs[name] = true;
        node.attributes.push({ name: name, value: value });
        i = end + 1;
      }
      return node;
    }

    while (pos < source.length) {
      if (source.slice(pos, pos + 4) === "<!--") {
        var commentEnd = source.indexOf("-->", pos + 4);
        if (commentEnd === -1 || source.slice(pos + 4, commentEnd).indexOf("--") !== -1) {
          throw new Error("Invalid XML comment.");
        }
        pos = commentEnd + 3;
        continue;
      }
      if (source.slice(pos, pos + 9) === "<![CDATA[") {
        var cdataEnd = source.indexOf("]]>", pos + 9);
        if (cdataEnd === -1 || !stack.length) throw new Error("Invalid CDATA section.");
        stack[stack.length - 1].childNodes.push({ nodeType: 3, nodeValue: source.slice(pos + 9, cdataEnd) });
        pos = cdataEnd + 3;
        continue;
      }
      if (/^<!DOCTYPE\b/i.test(source.slice(pos))) {
        throw new Error("DOCTYPE and custom entities are not supported.");
      }
      if (source.slice(pos, pos + 2) === "<?") {
        var piEnd = source.indexOf("?>", pos + 2);
        if (piEnd === -1) throw new Error("Unclosed XML declaration.");
        pos = piEnd + 2;
        continue;
      }
      if (source.slice(pos, pos + 2) === "</") {
        var closeEnd = source.indexOf(">", pos + 2);
        if (closeEnd === -1) throw new Error("Unclosed XML closing tag.");
        var closeName = source.slice(pos + 2, closeEnd).trim();
        var openNode = stack.pop();
        if (!openNode || closeName !== openNode.nodeName) throw new Error("Mismatched XML closing tag.");
        pos = closeEnd + 1;
        continue;
      }
      if (source.charAt(pos) === "<") {
        if (source.slice(pos, pos + 2) === "<!") throw new Error("Unsupported XML declaration.");
        var tagEnd = findTagEnd(pos + 1);
        var body = source.slice(pos + 1, tagEnd);
        var selfClosing = /\/\s*$/.test(body);
        if (selfClosing) body = body.replace(/\/\s*$/, "");
        var node = parseStartTag(body);
        if (stack.length) stack[stack.length - 1].childNodes.push(node);
        else if (root) throw new Error("XML must have one root element.");
        else root = node;
        if (!selfClosing) {
          if (stack.length >= 128) throw new Error("XML nesting is too deep (128 levels maximum).");
          stack.push(node);
        }
        pos = tagEnd + 1;
        continue;
      }
      var textEnd = source.indexOf("<", pos);
      if (textEnd === -1) textEnd = source.length;
      addText(source.slice(pos, textEnd));
      pos = textEnd;
    }
    if (stack.length || !root) throw new Error("XML is incomplete.");
    return root;
  }

  function xmlNodeToJson(node) {
    var obj = Object.create(null);
    var i;
    for (i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i];
      obj["@" + a.name] = a.value;
    }
    var hasElementChildren = false;
    var textParts = [];
    for (i = 0; i < node.childNodes.length; i++) {
      var ch = node.childNodes[i];
      if (ch.nodeType === 1) {
        hasElementChildren = true;
        var val = xmlNodeToJson(ch);
        if (obj[ch.nodeName] !== undefined) {
          if (!Array.isArray(obj[ch.nodeName])) obj[ch.nodeName] = [obj[ch.nodeName]];
          obj[ch.nodeName].push(val);
        } else {
          obj[ch.nodeName] = val;
        }
      } else if (ch.nodeType === 3) {
        if (ch.nodeValue.trim()) textParts.push(ch.nodeValue.trim());
      }
    }
    var text = textParts.join(" ");
    if (!hasElementChildren) {
      if (node.attributes.length === 0) return text;
      if (text) obj["#text"] = text;
    } else if (text) {
      obj["#text"] = text;
    }
    return obj;
  }

  els.x2j.addEventListener("click", function () {
    var text = els.xmlIn.value.trim();
    if (!text) { msg(els.msg1, "Paste some XML (or drop an .xml file) first.", "err"); return; }
    try {
      var root = parseXml(text);
      var result = Object.create(null);
      result[root.nodeName] = xmlNodeToJson(root);
      els.x2jOut.value = JSON.stringify(result, null, 2);
      els.x2jWrap.classList.remove("hidden");
      msg(els.msg1, "Converted to JSON.", "ok");
    } catch (e) {
      msg(els.msg1, e.message || "Invalid XML — check the tags.", "err");
    }
  });

  els.copyX2j.addEventListener("click", function () { copyText(els.x2jOut.value, function () { toast("JSON copied!", "ok"); }); });
  els.dlX2j.addEventListener("click", function () {
    if (els.x2jOut.value) downloadBlob(new Blob([els.x2jOut.value], { type: "application/json" }), "data.json");
  });

  /* ---------- JSON -> XML ---------- */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&" + "amp;")
      .replace(/</g, "&" + "lt;")
      .replace(/>/g, "&" + "gt;")
      .replace(/"/g, "&" + "quot;");
  }
  function safeTag(tag) {
    var t = String(tag).replace(/[^A-Za-z0-9_.-]/g, "_");
    if (!/^[A-Za-z_]/.test(t)) t = "_" + t;
    return t;
  }
  function jsonToXml(key, val, indent) {
    var pad = new Array(indent + 1).join("  ");
    var tag = safeTag(key);
    var out = "";
    var attrs = "";
    var inner = "";
    var i;

    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      var clone = Object.create(null);
      var keys = Object.keys(val);
      for (i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.charAt(0) === "@") {
          attrs += " " + safeTag(k.slice(1)) + '="' + esc(val[k]) + '"';
        } else {
          clone[k] = val[k];
        }
      }
      keys = Object.keys(clone);
      for (i = 0; i < keys.length; i++) {
        inner += jsonToXml(keys[i], clone[keys[i]], indent + 1);
      }
    } else if (Array.isArray(val)) {
      for (i = 0; i < val.length; i++) out += jsonToXml(key, val[i], indent);
      return out;
    } else {
      inner = esc(val);
    }

    if (inner.indexOf("\n") === -1 && inner.length < 70 && !/<[A-Za-z_]/.test(inner)) {
      out += pad + "<" + tag + attrs + ">" + inner + "</" + tag + ">\n";
    } else {
      out += pad + "<" + tag + attrs + ">\n" + inner + pad + "</" + tag + ">\n";
    }
    return out;
  }

  els.j2x.addEventListener("click", function () {
    var text = els.jsonIn.value.trim();
    if (!text) { msg(els.msg2, "Paste some JSON first.", "err"); return; }
    try {
      var data = JSON.parse(text);
      var rootKey = (data !== null && typeof data === "object" && !Array.isArray(data)) ? Object.keys(data)[0] : "root";
      var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i++) xml += jsonToXml("item", data[i], 0);
      } else if (typeof data === "object" && data !== null) {
        if (Object.keys(data).length !== 1) {
          xml += jsonToXml(rootKey, data, 0);
        } else {
          xml += jsonToXml(rootKey, data[rootKey], 0);
        }
      } else {
        xml += jsonToXml("value", data, 0);
      }
      els.j2xOut.value = xml;
      els.j2xWrap.classList.remove("hidden");
      msg(els.msg2, "Converted to XML.", "ok");
    } catch (e) {
      msg(els.msg2, "Invalid JSON: " + e.message, "err");
    }
  });

  els.copyJ2x.addEventListener("click", function () { copyText(els.j2xOut.value, function () { toast("XML copied!", "ok"); }); });
  els.dlJ2x.addEventListener("click", function () {
    if (els.j2xOut.value) downloadBlob(new Blob([els.j2xOut.value], { type: "application/xml" }), "data.xml");
  });

})();
