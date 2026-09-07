const fileInput = document.querySelector('#file-input');
const dropzone = document.querySelector('#dropzone');
const queuedFiles = document.querySelector('#queued-files');
const compressButton = document.querySelector('#compress-btn');
const qualityInput = document.querySelector('#quality');
const qualityValue = document.querySelector('#quality-value');
const formatSelect = document.querySelector('#format');
const resultsSection = document.querySelector('#results');
const resultGrid = document.querySelector('#result-grid');
const summary = document.querySelector('#summary');
const toast = document.querySelector('#toast');

let files = [];
let processed = [];

const bytes = (size) => size < 1024 * 1024 ? `${(size / 1024).toFixed(size < 100 * 1024 ? 1 : 0)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
const notify = (message) => { toast.textContent = message; toast.classList.add('toast-visible'); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => toast.classList.remove('toast-visible'), 2800); };
const isSupported = (file) => file.type.startsWith('image/') && file.size <= 25 * 1024 * 1024;

function setFiles(incoming) {
  const valid = [...incoming].filter(isSupported);
  const rejected = incoming.length - valid.length;
  if (rejected) notify('部分文件格式不支持或超过 25MB，已跳过。');
  const room = 20 - files.length;
  files = files.concat(valid.slice(0, room));
  if (valid.length > room) notify('单次最多可处理 20 张图片。');
  renderQueue();
}

function renderQueue() {
  queuedFiles.innerHTML = '';
  queuedFiles.hidden = files.length === 0;
  files.forEach((file, index) => {
    const row = document.querySelector('#queued-template').content.firstElementChild.cloneNode(true);
    row.querySelector('.queued-thumb').style.backgroundImage = `url("${URL.createObjectURL(file)}")`;
    row.querySelector('.queued-name').textContent = `${file.name} · ${bytes(file.size)}`;
    row.querySelector('button').addEventListener('click', () => { files.splice(index, 1); renderQueue(); });
    queuedFiles.append(row);
  });
  compressButton.disabled = files.length === 0;
  compressButton.querySelector('span').textContent = files.length ? `压缩 ${files.length} 张图片` : '开始压缩';
}

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = `${qualityInput.value}%`;
  document.querySelectorAll('input[name="preset"]').forEach((input) => { input.checked = input.value === qualityInput.value; });
});
document.querySelectorAll('input[name="preset"]').forEach((input) => input.addEventListener('change', () => { qualityInput.value = input.value; qualityInput.dispatchEvent(new Event('input')); }));
fileInput.addEventListener('change', (event) => { setFiles(event.target.files); fileInput.value = ''; });
['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
dropzone.addEventListener('drop', (event) => setFiles(event.dataTransfer.files));

compressButton.addEventListener('click', async () => {
  if (!files.length) return;
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  form.append('quality', qualityInput.value);
  form.append('format', formatSelect.value);
  compressButton.classList.add('is-loading');
  compressButton.querySelector('span').textContent = '正在压缩…';
  try {
    const response = await fetch('/api/compress', { method: 'POST', body: form });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message);
    processed = payload.results.map((item, index) => ({ ...item, originalDataUrl: URL.createObjectURL(files[index]) }));
    renderResults();
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { notify(error.message || '处理失败，请重试。'); }
  finally { compressButton.classList.remove('is-loading'); renderQueue(); }
});

function download(dataUrl, filename) {
  const link = document.createElement('a'); link.href = dataUrl; link.download = filename; document.body.append(link); link.click(); link.remove();
}

function renderResults() {
  resultGrid.innerHTML = '';
  const originalTotal = processed.reduce((sum, item) => sum + item.original.size, 0);
  const compressedTotal = processed.reduce((sum, item) => sum + item.compressed.size, 0);
  const rate = originalTotal ? Math.max(0, Math.round((1 - compressedTotal / originalTotal) * 100)) : 0;
  summary.textContent = `已完成 ${processed.length} 张图片处理，共节省 ${bytes(Math.max(0, originalTotal - compressedTotal))}（${rate}%）`;
  processed.forEach((item) => {
    const card = document.querySelector('#result-template').content.firstElementChild.cloneNode(true);
    card.querySelector('.result-name').textContent = item.name;
    card.querySelector('.original-image').src = item.originalDataUrl;
    card.querySelector('.compressed-image').src = item.compressed.dataUrl;
    card.querySelector('.original-size').textContent = bytes(item.original.size);
    card.querySelector('.compressed-size').textContent = bytes(item.compressed.size);
    card.querySelector('.original-dimensions').textContent = `${item.original.width} × ${item.original.height}`;
    card.querySelector('.compressed-dimensions').textContent = `${item.compressed.width} × ${item.compressed.height}`;
    card.querySelector('.saving-rate').textContent = `${Math.max(0, Math.round((1 - item.compressed.size / item.original.size) * 100))}%`;
    card.querySelector('.single-download').addEventListener('click', () => download(item.compressed.dataUrl, item.outputName));
    resultGrid.append(card);
  });
  resultsSection.hidden = false;
}

document.querySelector('#download-all').addEventListener('click', async () => {
  if (!processed.length) return;
  const button = document.querySelector('#download-all');
  button.disabled = true; button.textContent = '正在打包…';
  try {
    const response = await fetch('/api/download-zip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: processed.map((item) => ({ name: item.outputName, dataUrl: item.compressed.dataUrl })) }) });
    if (!response.ok) throw new Error('压缩包生成失败');
    const link = document.createElement('a'); link.href = URL.createObjectURL(await response.blob()); link.download = 'compressed-images.zip'; document.body.append(link); link.click(); link.remove();
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; button.innerHTML = '<span aria-hidden="true">↓</span>下载全部 ZIP'; }
});
