/* PDF Merge — combine PDFs in order, using pdf-lib locally */
"use strict";

(function () {

  if (typeof PDFLib === "undefined") { missingLib("pdf-lib"); return; }
  var { PDFDocument } = PDFLib;

  var files = [];
  var uid = 0;

  var els = {
    dropzone: document.getElementById("dropzone"),
    fileList: document.getElementById("file-list"),
    emptyHint: document.getElementById("empty-hint"),
    mergeBtn: document.getElementById("merge-btn"),
    clearBtn: document.getElementById("clear-btn"),
    msg: document.getElementById("msg")
  };

  makeDropzone({
    el: els.dropzone,
    accept: "pdf",
    multiple: true,
    paste: false,
    onFiles: function (list) {
      list.forEach(function (f) {
        if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) files.push({ file: f, id: ++uid });
      });
      render();
    }
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


  els.clearBtn.addEventListener("click", function () {
    files = [];
    render();
    els.msg.className = "msg";
  });

  function render() {
    els.mergeBtn.disabled = files.length < 2;
    els.clearBtn.disabled = !files.length;
    els.fileList.innerHTML = "";
    if (!files.length) {
      els.fileList.appendChild(els.emptyHint.cloneNode(true));
      return;
    }
    files.forEach(function (item, i) {
      var thumb = document.createElement("div");
      thumb.className = "thumb pdf";
      thumb.textContent = "📄";

      var row = renderFileRow(item.file, {
        thumbElement: thumb,
        nameHtml: (i + 1) + ". " + escapeHtml(item.file.name),
        controls: [
          ["↑", "Move up: " + item.file.name, function () { move(i, -1); }],
          ["↓", "Move down: " + item.file.name, function () { move(i, 1); }],
          ["✕", "Remove: " + item.file.name, function () { files = files.filter(function (x) { return x.id !== item.id; }); render(); }]
        ]
      });
      els.fileList.appendChild(row);
    });
  }

  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= files.length) return;
    var tmp = files[i];
    files[i] = files[j];
    files[j] = tmp;
    render();
  }

  els.mergeBtn.addEventListener("click", async function () {
    if (files.length < 2) return;
    if (isCloud()) { cloudMerge(); return; }
    localMerge();
  });

  function cloudMerge() {
    els.mergeBtn.disabled = true;
    var stop = CloudTools.trackProcessing(showMsg, files.length + " PDFs");
    CloudTools.post("/pdf/merge", {
      files: files.map(function (f) { return f.file; })
    }, function (pct) { showMsg("Uploading… " + pct + "%", "info"); }).then(function (res) {
      stop();
      var blob = new Blob([res.bytes], { type: "application/pdf" });
      downloadBlob(blob, "merged.pdf");
      showMsg("Done! merged.pdf (" + formatBytes(blob.size) + ") created on the server from " + files.length + " documents.", "ok");
      toast("merged.pdf downloaded", "ok");
      els.mergeBtn.disabled = false;
    }).catch(function () {
      stop();
      showMsg("Cloud server unavailable — merging on your device instead. Your files never left it.", "info");
      localMerge();
    });
  }

  async function localMerge() {
    if (files.length < 2) return;
    els.mergeBtn.disabled = true;
    showMsg("Merging " + files.length + " PDFs…", "info");

    try {
      var merged = await PDFDocument.create();
      for (var i = 0; i < files.length; i++) {
        var buf = await readFileAsArrayBuffer(files[i].file);
        var src = await PDFDocument.load(buf, { ignoreEncryption: true });
        var pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(function (p) { merged.addPage(p); });
      }
      var out = await merged.save();
      var blob = new Blob([out], { type: "application/pdf" });
      downloadBlob(blob, "merged.pdf");
      var totalIn = files.reduce(function (a, b) { return a + b.file.size; }, 0);
      showMsg("Done! merged.pdf (" + formatBytes(blob.size) + ") created from " + files.length + " documents.", "ok");
      toast("merged.pdf downloaded", "ok");
    } catch (err) {
      showMsg("Merge failed: " + (err.message || String(err)), "err");
    }
    els.mergeBtn.disabled = false;
  }

  function showMsg(text, kind) {
    els.msg.textContent = text;
    els.msg.className = "msg " + (kind || "info");
  }

})();
