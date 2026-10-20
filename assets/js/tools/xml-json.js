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
  /* DTDs and custom entities are deliberately unsupported; they are not needed
     by the converter and can expand into unsafe or unbounded content. */
  function parseXml(source) {
    if (source.length > 2 * 1024 * 1024) throw new Error("XML is too large (2 MB maximum).");
    if (/<!DOCTYPE\b/i.test(source)) {
      throw new Error("DOCTYPE and custom entities are not supported.");
    }
    var parser = new DOMParser();

    // XML-mode nodes are copied into JSON and never attached to the HTML DOM.
    var doc = parser.parseFromString(source, "application/xml");
    var root = doc.documentElement;
    if (root && root.localName === "parsererror" &&
        root.namespaceURI === "http://www.mozilla.org/newlayout/xml/parsererror.xml") {
      throw new Error("Invalid XML — check the tags.");
    }
    if (!doc.documentElement) {
      throw new Error("XML is incomplete.");
    }
    return doc.documentElement;
  }

  function xmlNodeToJson(node, depth) {
    depth = depth || 0;
    if (depth >= 128) throw new Error("XML nesting is too deep (128 levels maximum).");
    var obj = Object.create(null);
    var i;
    if (node.attributes) {
      for (i = 0; i < node.attributes.length; i++) {
        var a = node.attributes[i];
        obj["@" + a.name] = a.value;
      }
    }
    var hasElementChildren = false;
    var textParts = [];
    for (i = 0; i < node.childNodes.length; i++) {
      var ch = node.childNodes[i];
      if (ch.nodeType === 1) {
        hasElementChildren = true;
        var val = xmlNodeToJson(ch, depth + 1);
        if (obj[ch.nodeName] !== undefined) {
          if (!Array.isArray(obj[ch.nodeName])) obj[ch.nodeName] = [obj[ch.nodeName]];
          obj[ch.nodeName].push(val);
        } else {
          obj[ch.nodeName] = val;
        }
      } else if (ch.nodeType === 3 || ch.nodeType === 4) {
        if (ch.nodeValue.trim()) textParts.push(ch.nodeValue.trim());
      }
    }
    var text = textParts.join(" ");
    if (!hasElementChildren) {
      if (!node.attributes || node.attributes.length === 0) return text;
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
    var attrs = "";
    var inner = "";
    var i;

    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      var keys = Object.keys(val);
      var innerArr = [];
      for (i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.charAt(0) === "@") {
          attrs += " " + safeTag(k.slice(1)) + '="' + esc(val[k]) + '"';
        } else {
          innerArr.push(jsonToXml(k, val[k], indent + 1));
        }
      }
      inner = innerArr.join("");
    } else if (Array.isArray(val)) {
      if (val.length > 0) {
        var outArr = [];
        for (i = 0; i < val.length; i++) outArr.push(jsonToXml(key, val[i], indent));
        return outArr.join("");
      }
      return "";
    } else {
      inner = esc(val);
    }

    if (inner.indexOf("\n") === -1 && inner.length < 70 && !/<[A-Za-z_]/.test(inner)) {
      return pad + "<" + tag + attrs + ">" + inner + "</" + tag + ">\n";
    } else {
      return pad + "<" + tag + attrs + ">\n" + inner + pad + "</" + tag + ">\n";
    }
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
