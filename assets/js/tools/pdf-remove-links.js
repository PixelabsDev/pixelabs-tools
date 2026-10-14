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

  function load(file) {
    if (!file || (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))) {
      toast("Please choose a PDF file.", "err");
      return;
    }
    readFileAsArrayBuffer(file).then(async function (buf) {
      var doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      var found = survey(doc);
      state.file = file;
      state.pageCount = doc.getPageCount();
      state.total = found.total;
      state.links = found.links;

      var bits = "<b>" + escapeHtml(file.name) + "</b> — " + state.pageCount +
        " page" + (state.pageCount === 1 ? "" : "s") + " · " + formatBytes(file.size);
      if (found.total === 0) {
        bits += " · <b>no links or annotations found</b>";
      } else {
        bits += " · found <b>" + found.links + "</b> link" + (found.links === 1 ? "" : "s");
        var others = found.total - found.links;
        if (others > 0) bits += " and <b>" + others + "</b> other annotation" + (others === 1 ? "" : "s");
      }
      els.docInfo.innerHTML = bits;

      els.editor.classList.remove("hidden");
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
      var doc = await PDFDocument.load(buf, { ignoreEncryption: true });

      var result = strip(doc, mode);
      var bytes = await doc.save();

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
