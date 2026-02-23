let currentTab = 'url';
let fileSrc = null;
let quantEnabled = true; // color quantization on by default

// Drag & drop
const dz = document.getElementById('dropZone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadFile(f);
});

function switchTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('urlTab').style.display = tab === 'url' ? '' : 'none';
  document.getElementById('fileTab').style.display = tab === 'file' ? '' : 'none';
}

function handleFile(input) {
  if (input.files[0]) loadFile(input.files[0]);
}

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    fileSrc = e.target.result;
    document.getElementById('fileThumb').src = fileSrc;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
    document.getElementById('fileInfo').classList.add('show');
    toast('Image loaded!', '🖼️');
  };
  reader.readAsDataURL(file);
}

function toggleQuant() {
  quantEnabled = !quantEnabled;
  const btn = document.getElementById('quantToggle');
  btn.classList.toggle('on', quantEnabled);
  btn.setAttribute('aria-pressed', quantEnabled);
  document.getElementById('toggleDesc').textContent = quantEnabled
    ? 'On — colors are grouped into fewer shades'
    : 'Off — exact pixel colors, no grouping';
  toast(quantEnabled ? 'Quantization on' : 'Quantization off', '🎨');
}

function generate() {
  const src = currentTab === 'url'
    ? document.getElementById('imageUrl').value.trim()
    : fileSrc;

  if (!src) { toast('Please provide an image', '⚠️'); return; }

  const btn = document.getElementById('genBtn');
  btn.textContent = 'Generating...';
  btn.classList.add('loading');

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => processImage(img, src, btn);
  img.onerror = () => {
    btn.textContent = 'Generate';
    btn.classList.remove('loading');
    toast('Failed to load image', '❌');
  };
  img.src = src;
}

function processImage(img, originalSrc, btn) {
  let tmp = document.createElement('canvas');
  tmp.width = img.width; tmp.height = img.height;
  tmp.getContext('2d').drawImage(img, 0, 0);

  let w = img.width, h = img.height;
  while (w > 64 || h > 64) {
    w = Math.max(Math.floor(w / 2), 32);
    h = Math.max(Math.floor(h / 2), 32);
    const s = document.createElement('canvas');
    s.width = w; s.height = h;
    const sc = s.getContext('2d');
    sc.imageSmoothingEnabled = true;
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(tmp, 0, 0, w, h);
    tmp = s;
  }

  const canvas = document.getElementById('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 32, 32);
  ctx.drawImage(tmp, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;

  const pixels = [];
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    if (quantEnabled) {
      r = Math.min(255, Math.floor(r / 16) * 16);
      g = Math.min(255, Math.floor(g / 16) * 16);
      b = Math.min(255, Math.floor(b / 16) * 16);
    }
    pixels.push([r, g, b]);
  }

  const pc = document.getElementById('previewCanvas');
  pc.width = 32; pc.height = 32;
  const pctx = pc.getContext('2d');
  const pd = pctx.createImageData(32, 32);
  pixels.forEach((p, i) => {
    pd.data[i*4] = p[0]; pd.data[i*4+1] = p[1];
    pd.data[i*4+2] = p[2]; pd.data[i*4+3] = 255;
  });
  pctx.putImageData(pd, 0, 0);

  document.getElementById('originalImg').src = originalSrc;
  document.getElementById('outputBox').value = buildLua(pixels);
  document.getElementById('pixelCount').textContent = pixels.length;
  document.getElementById('resultCard').classList.add('show');

  btn.textContent = 'Generate';
  btn.classList.remove('loading');
  toast('Script generated!', '✅');
}

function buildLua(pixels) {
  return [
    `local pixels = {`,
    pixels.map(p => `  {${p[0]},${p[1]},${p[2]}}`).join(',\n'),
    `}`,
    `local grid = game:GetService("Players").LocalPlayer`,
    `  .PlayerGui:WaitForChild("MainGui").PaintFrame.GridHolder.Grid`,
    `for i, rgb in ipairs(pixels) do`,
    `  local c = grid:FindFirstChild(tostring(i))`,
    `  if c then c.BackgroundColor3 = Color3.fromRGB(table.unpack(rgb)) end`,
    `end`
  ].join('\n');
}

function copyOut() {
  const v = document.getElementById('outputBox').value;
  if (!v) return;
  navigator.clipboard.writeText(v)
    .then(() => toast('Copied!', '📋'))
    .catch(() => {
      document.getElementById('outputBox').select();
      document.execCommand('copy');
      toast('Copied!', '📋');
    });
}

function toast(msg, icon = '✅') {
  const el = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toastIcon').textContent = icon;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}
