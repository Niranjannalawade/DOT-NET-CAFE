/* ═══════════════════════════════════════════════════════════════════
   CyberCafe Pro — main.js
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ── Clock ───────────────────────────────────────────────────────── */
function updateTime() {
  const el = document.getElementById('timeDisplay');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN',
    { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateTime, 1000);
updateTime();

/* ── Sidebar ─────────────────────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ── Delete modal ────────────────────────────────────────────────── */
function confirmDelete(url, message) {
  document.getElementById('deleteMessage').textContent =
    message || 'Are you sure you want to delete this?';
  document.getElementById('deleteForm').action = url;
  document.getElementById('deleteModal').style.display = 'flex';
}
function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
}
const _dm = document.getElementById('deleteModal');
if (_dm) _dm.addEventListener('click', e => { if (e.target === _dm) closeDeleteModal(); });

/* ── Auto-dismiss flash ──────────────────────────────────────────── */
setTimeout(() => {
  document.querySelectorAll('.flash').forEach(el => {
    el.style.transition = 'opacity .5s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  });
}, 4000);

/* ── Drag & drop upload ──────────────────────────────────────────── */
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone')?.classList.add('dz-hover');
}
function handleDragLeave() {
  document.getElementById('uploadZone')?.classList.remove('dz-hover');
}
function handleDrop(e) {
  e.preventDefault();
  handleDragLeave();
  const files = e.dataTransfer.files;
  if (!files.length) return;
  const input = document.getElementById('docFileInput');
  if (!input) return;
  try {
    const dt = new DataTransfer();
    dt.items.add(files[0]);
    input.files = dt.files;
  } catch (_) {}
  showPreview(files[0]);
}
function onFileChosen(input) {
  if (input.files?.length) showPreview(input.files[0]);
}
function showPreview(file) {
  document.getElementById('filePreviewName').textContent = file.name;
  document.getElementById('filePreviewSize').textContent = fmtBytes(file.size);
  document.getElementById('filePreviewBar').style.display    = 'flex';
  document.getElementById('uploadBtnWrap').style.display     = 'flex';
}
function clearFileChoice() {
  const inp = document.getElementById('docFileInput');
  if (inp) inp.value = '';
  document.getElementById('filePreviewBar').style.display = 'none';
  document.getElementById('uploadBtnWrap').style.display  = 'none';
}
function showUploadSpinner(btn) {
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…';
  btn.disabled  = true;
}
const _uf = document.getElementById('uploadForm');
if (_uf) _uf.addEventListener('submit', function () {
  const btn = this.querySelector('.btn-upload-go');
  if (btn) showUploadSpinner(btn);
});


/* ═══════════════════════════════════════════════════════════════════
   SCANNER SETTINGS PANEL
   ═══════════════════════════════════════════════════════════════════ */

function toggleScannerSettings() {
  const panel = document.getElementById('scannerSettingsPanel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  if (isHidden) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setExamplePath(path) {
  const inp = document.getElementById('scannerPathInput');
  if (inp) inp.value = path;
}

function saveScannerPath() {
  const inp  = document.getElementById('scannerPathInput');
  const path = inp ? inp.value.trim() : '';
  const stat = document.getElementById('settingsStatus');

  if (!path) {
    showSettingsStatus('error', 'Please enter a folder path.');
    return;
  }

  showSettingsStatus('loading',
    '<i class="fa-solid fa-spinner fa-spin"></i> Validating path…');

  fetch('/scanner/config', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ path: path }),
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      showSettingsStatus('success',
        '<i class="fa-solid fa-check-circle"></i> Path saved! ' +
        '<code>' + escHtml(data.path) + '</code>');
      // Refresh page so the "latest scan" preview updates
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showSettingsStatus('error',
        '<i class="fa-solid fa-exclamation-circle"></i> ' + escHtml(data.message));
    }
  })
  .catch(() => showSettingsStatus('error', 'Network error. Is Flask running?'));
}

function showSettingsStatus(type, html) {
  const el = document.getElementById('settingsStatus');
  if (!el) return;
  el.style.display = 'block';
  el.className     = 'settings-status status-' + type;
  el.innerHTML     = html;
}


/* ═══════════════════════════════════════════════════════════════════
   SCAN & UPLOAD — import from scanner folder (primary workflow)

   Real workflow
   ─────────────
   1. Customer comes in with a document.
   2. Operator scans it using scanner machine software.
      → Scanner saves file to the configured watch folder
        e.g.  C:\Users\Admin\Documents\Scans\scan001.pdf
   3. Operator opens the customer profile in the browser.
   4. Operator clicks  [ 🖨  Scan & Upload ].
   5. importFromScannerFolder() calls  POST /scan_from_folder/<id>.
   6. Flask reads the watch folder, finds the newest file,
      copies it to  static/uploads/<CustomerName>/,
      saves a DB record, and returns JSON.
   7. JS shows a success toast then reloads the page.
      → The scanned file now appears in the Documents list.
   ═══════════════════════════════════════════════════════════════════ */

function importFromScannerFolder(customerId) {
  const btn = document.getElementById('btnScanFolder');

  // Show loading state on button
  if (btn) {
    btn._origHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing…';
    btn.disabled  = true;
  }

  showScanToast('loading',
    '<i class="fa-solid fa-spinner fa-spin"></i> ' +
    'Looking for latest scanned file…');

  fetch('/scan_from_folder/' + customerId, { method: 'POST' })
  .then(r => r.json())
  .then(data => {
    resetScanButton(btn);

    if (data.ok) {
      showScanToast('success',
        '<i class="fa-solid fa-check-circle"></i> ' +
        escHtml(data.message) +
        '&nbsp; <span class="toast-folder">→ ' + escHtml(data.folder) + '/</span>');
      // Reload after short delay so user can read the success toast
      setTimeout(() => window.location.reload(), 2000);

    } else {
      showScanToast('error',
        '<i class="fa-solid fa-exclamation-circle"></i> ' +
        escHtml(data.message));

      // If Flask says to open settings, open the panel automatically
      if (data.action === 'open_settings') {
        setTimeout(() => {
          const panel = document.getElementById('scannerSettingsPanel');
          if (panel) {
            panel.style.display = 'block';
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 600);
      }
    }
  })
  .catch(err => {
    resetScanButton(btn);
    showScanToast('error',
      '<i class="fa-solid fa-wifi"></i> Network error — cannot reach server.');
    console.error('scan_from_folder error:', err);
  });
}

function resetScanButton(btn) {
  if (!btn) return;
  btn.innerHTML = btn._origHTML ||
    '<i class="fa-solid fa-scanner-image"></i> Scan &amp; Upload';
  btn.disabled  = false;
}


/* ═══════════════════════════════════════════════════════════════════
   MANUAL SCAN UPLOAD — fallback when no scanner folder is configured.
   Opens the OS file picker so the operator can navigate to the
   scanned file manually.
   ═══════════════════════════════════════════════════════════════════ */

function scanAndUpload(customerId) {
  const input = document.getElementById('scanFileInput');
  if (!input) return;
  input.dataset.customerId = customerId;
  input.value = '';
  input.click();
}

function uploadScan(input, customerId) {
  if (!input.files?.length) return;
  const file = input.files[0];

  const allowedExt = /\.(pdf|jpg|jpeg|png|gif|docx|doc|txt)$/i;
  if (!allowedExt.test(file.name)) {
    showScanToast('error', 'File type not allowed. Use PDF, JPG, PNG, DOCX or TXT.');
    input.value = '';
    return;
  }
  if (file.size > 16 * 1024 * 1024) {
    showScanToast('error', 'File is too large. Maximum is 16 MB.');
    input.value = '';
    return;
  }

  const fd = new FormData();
  fd.append('scan_file', file);

  showScanToast('loading',
    '<i class="fa-solid fa-spinner fa-spin"></i> Uploading "' +
    escHtml(file.name) + '"…');

  fetch('/upload_scan/' + customerId, { method: 'POST', body: fd })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      showScanToast('success',
        '<i class="fa-solid fa-check-circle"></i> ' + escHtml(data.message) +
        ' <span class="toast-folder">→ ' + escHtml(data.folder) + '/</span>');
      setTimeout(() => window.location.reload(), 2000);
    } else {
      showScanToast('error',
        '<i class="fa-solid fa-exclamation-circle"></i> ' + escHtml(data.message));
    }
  })
  .catch(() => showScanToast('error', 'Network error.'))
  .finally(() => { input.value = ''; });
}


/* ─── Toast helper ───────────────────────────────────────────────── */
function showScanToast(type, html) {
  const toast = document.getElementById('scanToast');
  const msg   = document.getElementById('scanToastMsg');
  if (!toast || !msg) return;
  toast.className = 'scan-toast toast-' + type;
  msg.innerHTML   = html;
  toast.style.display = 'block';
  clearTimeout(toast._t);
  if (type !== 'loading') {
    toast._t = setTimeout(() => { toast.style.display = 'none'; }, 5000);
  }
}

/* ─── Utility ────────────────────────────────────────────────────── */
function fmtBytes(b) {
  if (b < 1024)       return b + ' B';
  if (b < 1048576)    return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
