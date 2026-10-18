/* Frequency Tone Generator — local Web Audio oscillator */
"use strict";

(function () {
  var mode = document.getElementById("mode");
  var freq = document.getElementById("frequency");
  var freqValue = document.getElementById("frequency-value");
  var volume = document.getElementById("volume");
  var volumeValue = document.getElementById("volume-value");
  var duration = document.getElementById("sweep-duration");
  var start = document.getElementById("start-btn");
  var stop = document.getElementById("stop-btn");
  var msg = document.getElementById("msg");
  var ctx = null;
  var osc = null;
  var gain = null;
  var stopTimer = null;

  function updateMode() {
    var sweep = mode.value === "sweep";
    document.getElementById("frequency-option").classList.toggle("hidden", sweep);
    document.getElementById("sweep-option").classList.toggle("hidden", !sweep);
  }

  function setMessage(text, kind) {
    msg.textContent = text;
    msg.className = "msg " + (kind || "info");
  }

  function finish() {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = null;
    if (osc) {
      try { osc.stop(); } catch (e) { /* already stopped */ }
      osc.disconnect();
      osc = null;
    }
    if (gain) { gain.disconnect(); gain = null; }
    start.disabled = false;
    stop.disabled = true;
  }

  mode.addEventListener("change", updateMode);
  freq.addEventListener("input", function () { freqValue.textContent = freq.value; });
  volume.addEventListener("input", function () { volumeValue.textContent = volume.value; });
  stop.addEventListener("click", function () {
    finish();
    setMessage("Sound stopped.", "ok");
  });

  start.addEventListener("click", function () {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) { setMessage("Web Audio is not supported in this browser.", "err"); return; }
    finish();
    try {
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      var maxFreq = Math.min(20000, Math.floor(ctx.sampleRate / 2) - 1);
      freq.max = String(maxFreq);
      if (Number(freq.value) > maxFreq) freq.value = String(maxFreq);
      freqValue.textContent = freq.value;
      document.getElementById("device-limit").textContent = "Browser audio sample rate: " + ctx.sampleRate.toLocaleString() + " Hz; requested tones are capped at " + maxFreq.toLocaleString() + " Hz. Your speaker may have a lower range.";
      var now = ctx.currentTime;
      osc = ctx.createOscillator();
      gain = ctx.createGain();
      osc.type = "sine";
      var level = Number(volume.value) / 100; /* conservative peak gain, capped at 0.1 */
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      var seconds;
      if (mode.value === "sweep") {
        seconds = Number(duration.value);
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(maxFreq, now + seconds);
      } else {
        seconds = 30;
        osc.frequency.setValueAtTime(Number(freq.value), now);
      }
      osc.start(now);
      start.disabled = true;
      stop.disabled = false;
      setMessage((mode.value === "sweep" ? "Playing a " + seconds + " second sweep" : "Playing " + freq.value + " Hz") + ". It will stop automatically after " + seconds + " seconds.", "info");
      stopTimer = setTimeout(function () {
        finish();
        setMessage("Playback finished.", "ok");
      }, seconds * 1000);
    } catch (e) {
      finish();
      setMessage("Could not start audio. Check your browser's audio settings and try again.", "err");
    }
  });

  updateMode();
})();
