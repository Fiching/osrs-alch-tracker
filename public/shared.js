'use strict';

// ── Number formatting ─────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtSigned(p) {
  if (p === null || p === undefined) return '—';
  return (p >= 0 ? '+' : '') + fmt(p);
}

function profitClass(p) {
  if (p === null || p === undefined) return 'break-even';
  return p > 0 ? 'positive' : p < 0 ? 'negative' : 'break-even';
}

// ── Cache status countdown ────────────────────────────────────────────────
let _countdownInterval = null;

function updateCacheStatus(lastUpdated, nextUpdate) {
  if (lastUpdated) {
    const d = new Date(lastUpdated);
    const el = document.getElementById('last-updated');
    if (el) el.textContent = 'Prices from ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (_countdownInterval) clearInterval(_countdownInterval);
  if (!nextUpdate) return;
  const el = document.getElementById('next-update');
  if (!el) return;
  _countdownInterval = setInterval(() => {
    const ms = new Date(nextUpdate) - Date.now();
    if (ms <= 0) {
      el.textContent = 'updating soon';
      clearInterval(_countdownInterval);
      return;
    }
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    el.textContent = `next update in ${m}m ${s.toString().padStart(2,'0')}s`;
  }, 1000);
}

// ── Icon error handling ───────────────────────────────────────────────────
function wireIcons(container) {
  container.querySelectorAll('img.item-icon[data-src]').forEach(img => {
    img.onerror = function () {
      const ph = document.createElement('div');
      ph.className = 'item-icon-placeholder';
      this.replaceWith(ph);
    };
    img.src = img.dataset.src;
  });
}

// ── Error display ─────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('loading-msg');
  if (el) el.innerHTML = `<div class="error-msg">Could not load prices.<br><small>${msg}</small></div>`;
}
