/* PDF Link Remover — strip hyperlinks (or every annotation) from a PDF.
   Local mode edits the document's annotation objects directly with pdf-lib,
   so the page content is never touched: text stays selectable, images and
   vectors are not re-rendered, and the layout cannot shift. */
"use strict";

(function () {

  if (typeof PDFLib === "undefined") { missingLib("pdf-lib"); return; }
  var PDFDocument = PDFLib.PDFDocument;
  var PDFName = PDFLib.PDFName;

  var state = { file: null, pageCount: 0, total: 0, links: 0 };

  var els = {
    dropzone: document.getElementById("dropzone"),
    editor: document.getElementById("editor"),
    docInfo: document.getElementById("doc-info"),
    mode: document.getElementById("mode"),
    runBtn: document.getElementById("run-btn"),
    clearBtn: document.getElementById("clear-btn"),
    msg: document.getElementById("msg")
  };

  makeDropzone({
    el: els.dropzone,
    accept: "pdf",
    multiple: false,
    paste: false,
    onFiles: function (list) { load(list[0]); }
  });

  /* ---- Local / Cloud toggle ---- */
  var procEl = document.getElementById("proc");
  var procNote = document.getElementById("proc-note");
  function isCloud() { return procEl && procEl.value === "cloud"; }
  function updateProcNote() {
    if (!procNote) return;
    procNote.textContent = isCloud()
      ? "Cloud mode: the file is uploaded to our own processing server, processed, and deleted immediately — nothing is stored. If the server is busy, the tool falls back to local processing automatically."
      : "How it works (local): everything runs on your device — nothing ever leaves it. Works offline too.";
  }
  if (procEl) procEl.addEventListener("change", updateProcNote);
  updateProcNote();

  /* ================= pdf-lib helpers ================= */

  /* A PDF name object can hand back "/Link" or "Link" depending on how it is
     read, so normalise to the bare form before comparing. */
  function nameStr(v) {
    if (!v) return "";
    var s;
    if (typeof v.asString === "function") s = v.asString();
    else if (typeof v.decodeText === "function") s = v.decodeText();
    else s = String(v);
    s = String(s);
    return s.charAt(0) === "/" ? s.slice(1) : s;
  }

  /* "/Subtype" of one annotation entry, resolving an indirect reference. */
  function subtypeOf(ctx, entry) {
    try {
      var obj = ctx.lookup(entry);
      if (!obj || typeof obj.get !== "function") return "";
      return nameStr(obj.get(PDFName.of("Subtype")));
    } catch (e) {
      return "";
    }
  }

  function annotsOf(page) {
    try { return page.node.Annots(); } catch (e) { return undefined; }
  }

  /* Count annotations, and how many of them are links. */
  function survey(doc) {
    var total = 0, links = 0;
    doc.getPages().forEach(function (page) {
      var arr = annotsOf(page);
      if (!arr) return;
      for (var i = 0; i < arr.size(); i++) {
        total++;
        if (subtypeOf(doc.context, arr.get(i)) === "Link") links++;
      }
    });
    return { total: total, links: links };
  }

  /* Strip annotations in place. mode: "links" | "all". */
  function strip(doc, mode) {
    var removed = 0, pages = 0;
    doc.getPages().forEach(function (page) {
      var arr = annotsOf(page);
      if (!arr || !arr.size()) return;

      if (mode === "all") {
        /* Match the reference behaviour: drop the whole /Annots key. */
        var n = arr.size();
        try { page.node.delete(PDFName.of("Annots")); } catch (e) { return; }
        removed += n;
        pages++;
        return;
      }

      var here = 0;
      for (var i = arr.size() - 1; i >= 0; i--) {
        if (subtypeOf(doc.context, arr.get(i)) === "Link") {
          try { arr.remove(i); here++; } catch (e) { /* leave it */ }
        }
      }
      if (here) { removed += here; pages++; }
    });
    return { removed: removed, pages: pages };
  }

  /* ================= loading ================= */

  /* A PDF can be "protected": an owner password set, or a permissions lock
     that forbids copying or editing. Banks, textbooks and downloaded forms
     often ship this way, and they open normally — so nothing looks wrong.
     pdf-lib cannot decrypt one, and if it is told to ignore the encryption
     it will happily write out a file that no viewer can open. pypdf (the
     Cloud path) does handle them, so the honest answer is to say so and let
     the reader choose Cloud, rather than hand back a broken file. */
  var PROTECTED_MSG = "This PDF is protected — it carries an owner password or a " +
    "permissions lock, which question banks, textbooks and downloaded forms often " +
    "have. It opens normally, but a browser cannot safely rewrite it: Local mode " +
    "would hand you back a file that will not open. Switch Processing to Cloud " +
    "above and try again — the server handles protected files properly, and the " +
    "file is deleted as soon as the result comes back.";

  function isProtected(err) {
    return /encrypt/i.test(String((err && err.message) || err));
  }

  /* Load without ever ignoring encryption, so a protected file fails loudly
     here instead of silently producing a broken one. */
  async function openPdf(buf) {
    return PDFDocument.load(buf);
  }

  /* A last line of defence: never hand back a file we cannot vouch for.
     A valid PDF ends with %%EOF and carries a /Root reference. If either is
     missing the bytes are truncated or half-written — the kind of file that
     opens as "Can't open PDF". Discard it and say so, rather than saving it. */
  function bytesToStr(bytes, from, to) {
    var out = "";
    for (var i = from; i < to; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  function looksLikePdf(bytes) {
    if (!bytes || bytes.length < 200) return false;
    var tail = bytesToStr(bytes, Math.max(0, bytes.length - 2048), bytes.length);
    if (tail.indexOf("%%EOF") === -1) return false;
    var head = bytesToStr(bytes, 0, Math.min(bytes.length, 4096));
    var end = bytesToStr(bytes, Math.max(0, bytes.length - 8192), bytes.length);
    return (head + end).indexOf("/Root") !== -1;
  }

  var BROKEN_MSG = "Something went wrong while writing the file, and the result " +
    "would not open — so it has been discarded rather than saved. Some PDFs are " +
    "too complex for in-browser rewriting. Switch Processing to Cloud and try " +
    "again: the server handles these properly, and the file is deleted as soon " +
    "as the result comes back.";

  function load(file) {
    if (!file || (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))) {
      toast("Please choose a PDF file.", "err");
      return;
    }
    readFileAsArrayBuffer(file).then(async function (buf) {
      var doc;
      try {
        doc = await openPdf(buf);
      } catch (err) {
        if (isProtected(err)) { showMsg(PROTECTED_MSG, "err"); toast("This PDF is protected — see the note below.", "err"); return; }
        throw err;
      }
      var found = survey(doc);
      state.file = file;
      state.pageCount = doc.getPageCount();
      state.total = found.total;
      state.links = found.links;

      var bits = "<b>" + escapeHtml(file.name) + "</b> — " + state.pageCount +
        " page" + (state.pageCount === 1 ? "" : "s") + " · " + formatBytes(file.size);
      els.editor.classList.remove("hidden");
      if (found.total === 0) {
        bits += " · <b>no links or annotations found</b>";
      } else {
        bits += " · found <b>" + found.links + "</b> link" + (found.links === 1 ? "" : "s");
        var others = found.total - found.links;
        if (others > 0) bits += " and <b>" + others + "</b> other annotation" + (others === 1 ? "" : "s");
      }
      els.docInfo.innerHTML = bits;

      els.editor.scrollIntoView({ behavior: "smooth", block: "start" });
      showMsg("", "");
    }).catch(function (err) {
      toast("Could not read that PDF: " + (err.message || "invalid file"), "err");
    });
  }

  els.clearBtn.addEventListener("click", function () {
    state.file = null;
    els.editor.classList.add("hidden");
    els.msg.className = "msg";
  });

  els.runBtn.addEventListener("click", function () {
    if (!state.file) return;
    if (isCloud()) { cloudRun(); return; }
    localRun();
  });

  /* ================= cloud path ================= */

  function cloudRun() {
    els.runBtn.disabled = true;
    var stop = CloudTools.trackProcessing(showMsg, "your PDF");
    CloudTools.post("/pdf/remove-annotations", {
      file: state.file, mode: els.mode.value
    }, function (pct) {
      showMsg("Uploading… " + pct + "%", "info");
    }).then(function (res) {
      stop();
      if (!looksLikePdf(res.bytes)) { showMsg(BROKEN_MSG, "err"); els.runBtn.disabled = false; return; }
      var blob = new Blob([res.bytes], { type: "application/pdf" });
      downloadBlob(blob, baseName(state.file.name) + "-clean.pdf");
      showMsg("Done! Cleaned on the server (" + formatBytes(blob.size) + ").", "ok");
      els.runBtn.disabled = false;
    }).catch(function () {
      stop();
      showMsg("Cloud server unavailable — cleaning on your device instead. Your file never left it.", "info");
      localRun();
    });
  }

  /* ================= local path ================= */

  async function localRun() {
    if (!state.file) return;
    els.runBtn.disabled = true;
    var mode = els.mode.value;

    try {
      showMsg(mode === "all" ? "Removing every annotation…" : "Removing links…", "info");
      var buf = await readFileAsArrayBuffer(state.file);
      var doc;
      try {
        doc = await openPdf(buf);
      } catch (err) {
        if (isProtected(err)) { showMsg(PROTECTED_MSG, "err"); els.runBtn.disabled = false; return; }
        throw err;
      }

      var result = strip(doc, mode);
      var bytes = await doc.save();

      if (!looksLikePdf(bytes)) {
        showMsg(BROKEN_MSG, "err");
        els.runBtn.disabled = false;
        return;
      }

      var blob = new Blob([bytes], { type: "application/pdf" });
      downloadBlob(blob, baseName(state.file.name) + "-clean.pdf");

      if (result.removed === 0) {
        showMsg("Nothing to remove — that PDF had no " +
          (mode === "all" ? "annotations" : "links") + ". A copy is still saved.", "info");
      } else {
        showMsg("Done! Removed " + result.removed + " " +
          (mode === "all" ? "annotation" : "link") + (result.removed === 1 ? "" : "s") +
          " across " + result.pages + " page" + (result.pages === 1 ? "" : "s") +
          " — " + formatBytes(blob.size) + ". The layout is untouched.", "ok");
      }
    } catch (err) {
      showMsg(err.message || String(err), "err");
    }
    els.runBtn.disabled = false;
  }

  function showMsg(text, kind) {
    els.msg.textContent = text;
    els.msg.className = text ? "msg " + (kind || "info") : "msg";
  }

})();
