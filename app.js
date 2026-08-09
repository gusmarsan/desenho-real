const cameraInput = document.querySelector('#cameraInput');
const galleryInput = document.querySelector('#galleryInput');
const emptyState = document.querySelector('#emptyState');
const selectedState = document.querySelector('#selectedState');
const drawingPreview = document.querySelector('#drawingPreview');
const transformButton = document.querySelector('#transformButton');
const changeImageButton = document.querySelector('#changeImageButton');
const pickerView = document.querySelector('#pickerView');
const loadingView = document.querySelector('#loadingView');
const loadingTitle = document.querySelector('#loadingTitle');
const loadingMessage = document.querySelector('#loadingMessage');
const resultView = document.querySelector('#resultView');
const resultOriginal = document.querySelector('#resultOriginal');
const resultImage = document.querySelector('#resultImage');
const saveButton = document.querySelector('#saveButton');
const saveOriginalButton = document.querySelector('#saveOriginalButton');
const shareButton = document.querySelector('#shareButton');
const againButton = document.querySelector('#againButton');
const errorView = document.querySelector('#errorView');
const errorMessage = document.querySelector('#errorMessage');
const retryButton = document.querySelector('#retryButton');
const confetti = document.querySelector('#confetti');
const openResultButton = document.querySelector('#openResultButton');
const resultLightbox = document.querySelector('#resultLightbox');
const closeLightboxButton = document.querySelector('#closeLightboxButton');
const fullscreenImage = document.querySelector('#fullscreenImage');
const toast = document.querySelector('#toast');
const savedDrawingsSection = document.querySelector('#savedDrawingsSection');
const savedDrawingsGrid = document.querySelector('#savedDrawingsGrid');

let selectedDataUrl = '';
let previewDataUrl = '';
let generatedDataUrl = '';
let loadingTimer = null;
let toastTimer = null;

const DB_NAME = 'desenho-real-db';
const DB_VERSION = 1;
const STORE_NAME = 'drawings';
const MAX_SAVED_DRAWINGS = 8;

const loadingMessages = [
  ['Dando vida ao desenho…', 'A imaginação já está trabalhando!'],
  ['Preparando a mágica…', 'Estou olhando cada pedacinho do desenho.'],
  ['Quase lá…', 'As cores e formas estão ganhando vida!'],
  ['Só mais um pouquinho…', 'A surpresa está ficando pronta.']
];

function showOnly(view) {
  [pickerView, loadingView, resultView, errorView].forEach((item) => {
    item.hidden = item !== view;
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  if (!message) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function resetPicker() {
  selectedDataUrl = '';
  previewDataUrl = '';
  generatedDataUrl = '';
  cameraInput.value = '';
  galleryInput.value = '';
  drawingPreview.removeAttribute('src');
  resultOriginal.removeAttribute('src');
  resultImage.removeAttribute('src');
  emptyState.hidden = false;
  selectedState.hidden = true;
  showOnly(pickerView);
  renderSavedDrawings();
}

async function loadImage(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return image;
}

async function prepareImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Escolha uma imagem do desenho.');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Essa foto está muito grande. Tente outra foto.');
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = imageUrl;
  await image.decode();

  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(imageUrl);

  return canvas.toDataURL('image/jpeg', 0.82);
}

async function makeLandscapePreview(dataUrl) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const width = 1200;
  const height = 800;
  const targetRatio = width / height;
  const sourceRatio = image.naturalWidth / image.naturalHeight;

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });

  let bgWidth;
  let bgHeight;
  let bgX;
  let bgY;

  if (sourceRatio > targetRatio) {
    bgHeight = height;
    bgWidth = height * sourceRatio;
    bgX = (width - bgWidth) / 2;
    bgY = 0;
  } else {
    bgWidth = width;
    bgHeight = width / sourceRatio;
    bgX = 0;
    bgY = (height - bgHeight) / 2;
  }

  context.save();
  context.filter = 'blur(32px) brightness(0.92)';
  context.drawImage(image, bgX - 30, bgY - 30, bgWidth + 60, bgHeight + 60);
  context.restore();

  let fgWidth;
  let fgHeight;
  let fgX;
  let fgY;

  if (sourceRatio > targetRatio) {
    fgWidth = width;
    fgHeight = width / sourceRatio;
    fgX = 0;
    fgY = (height - fgHeight) / 2;
  } else {
    fgHeight = height;
    fgWidth = height * sourceRatio;
    fgX = (width - fgWidth) / 2;
    fgY = 0;
  }

  context.drawImage(image, fgX, fgY, fgWidth, fgHeight);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSavedDrawings() {
  const db = await openDatabase();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_SAVED_DRAWINGS);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function saveDrawingInsideApp(source, preview) {
  const db = await openDatabase();
  if (!db) return;

  const existing = await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  const duplicate = existing.find((item) => item.source === source);
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  if (!duplicate) {
    store.put({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: Date.now(),
      source,
      preview
    });
  }

  const sorted = existing
    .filter((item) => !duplicate || item.id !== duplicate.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  while (sorted.length >= MAX_SAVED_DRAWINGS) {
    const oldest = sorted.pop();
    if (oldest) store.delete(oldest.id);
  }

  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  db.close();
}

async function renderSavedDrawings() {
  try {
    const drawings = await getSavedDrawings();
    savedDrawingsGrid.innerHTML = '';
    savedDrawingsSection.hidden = drawings.length === 0;

    drawings.slice(0, 6).forEach((drawing, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'saved-drawing-button';
      button.setAttribute('aria-label', `Usar desenho guardado ${index + 1}`);

      const image = document.createElement('img');
      image.src = drawing.preview || drawing.source;
      image.alt = '';
      button.appendChild(image);

      button.addEventListener('click', () => {
        selectedDataUrl = drawing.source;
        previewDataUrl = drawing.preview || drawing.source;
        drawingPreview.src = previewDataUrl;
        emptyState.hidden = true;
        selectedState.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      savedDrawingsGrid.appendChild(button);
    });
  } catch (error) {
    console.error('Saved drawings error:', error);
    savedDrawingsSection.hidden = true;
  }
}

async function selectImage(file) {
  try {
    selectedDataUrl = await prepareImage(file);
    previewDataUrl = await makeLandscapePreview(selectedDataUrl);
    drawingPreview.src = previewDataUrl;
    emptyState.hidden = true;
    selectedState.hidden = false;

    try {
      await saveDrawingInsideApp(selectedDataUrl, previewDataUrl);
      await renderSavedDrawings();
    } catch (storageError) {
      console.error('Could not save drawing locally:', storageError);
    }
  } catch (error) {
    showError(error.message || 'Não consegui abrir essa imagem.');
  }
}

function startLoadingMessages() {
  let index = 0;
  const update = () => {
    const [title, message] = loadingMessages[index % loadingMessages.length];
    loadingTitle.textContent = title;
    loadingMessage.textContent = message;
    index += 1;
  };
  update();
  loadingTimer = setInterval(update, 7000);
}

function stopLoadingMessages() {
  if (loadingTimer) clearInterval(loadingTimer);
  loadingTimer = null;
}

function showError(message) {
  stopLoadingMessages();
  errorMessage.textContent = message || 'Não consegui transformar esse desenho agora.';
  showOnly(errorView);
}

function celebrate() {
  confetti.innerHTML = '';
  const colors = ['#6c5ce7', '#ffd93d', '#ff77a8', '#5ac8fa', '#60d8b2'];

  for (let i = 0; i < 42; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    confetti.appendChild(piece);
  }

  setTimeout(() => { confetti.innerHTML = ''; }, 2400);
}

async function transformDrawing() {
  if (!selectedDataUrl) return;

  showOnly(loadingView);
  startLoadingMessages();
  transformButton.disabled = true;

  try {
    const response = await fetch('/api/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ image: selectedDataUrl })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || 'A mágica não funcionou desta vez.');
    }

    if (!payload.image) {
      throw new Error('A imagem não voltou pronta. Tente mais uma vez.');
    }

    generatedDataUrl = payload.image;
    resultOriginal.src = previewDataUrl || selectedDataUrl;
    resultImage.src = generatedDataUrl;
    fullscreenImage.src = generatedDataUrl;
    stopLoadingMessages();
    showOnly(resultView);
    celebrate();
  } catch (error) {
    showError(error.message || 'Não consegui transformar esse desenho agora.');
  } finally {
    transformButton.disabled = false;
  }
}

function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function saveResult() {
  downloadDataUrl(generatedDataUrl, `desenho-real-${Date.now()}.webp`);
  showToast('Resultado pronto para salvar no aparelho.');
}

function saveOriginal() {
  downloadDataUrl(selectedDataUrl, `meu-desenho-${Date.now()}.jpg`);
  showToast('Desenho pronto para salvar no aparelho.');
}

function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/webp';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}

async function shareResult() {
  if (!generatedDataUrl) return;

  try {
    const file = dataUrlToFile(generatedDataUrl, 'desenho-real.webp');
    const shareData = {
      files: [file],
      title: 'Desenho Real',
      text: 'Olha o que meu desenho virou! ✨'
    };

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share(shareData);
      return;
    }

    downloadDataUrl(generatedDataUrl, `desenho-real-${Date.now()}.webp`);
    window.open('https://wa.me/?text=Olha%20o%20que%20meu%20desenho%20virou!%20%E2%9C%A8', '_blank', 'noopener,noreferrer');
    showToast('Salvei a imagem. Agora é só anexar no WhatsApp.');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('Share error:', error);
      showToast('Não consegui abrir o compartilhamento agora.');
    }
  }
}

function openLightbox() {
  if (!generatedDataUrl) return;
  fullscreenImage.src = generatedDataUrl;
  resultLightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  closeLightboxButton.focus();
}

function closeLightbox() {
  resultLightbox.hidden = true;
  document.body.style.overflow = '';
  openResultButton.focus();
}

cameraInput.addEventListener('change', (event) => selectImage(event.target.files?.[0]));
galleryInput.addEventListener('change', (event) => selectImage(event.target.files?.[0]));
transformButton.addEventListener('click', transformDrawing);
changeImageButton.addEventListener('click', () => galleryInput.click());
retryButton.addEventListener('click', transformDrawing);
againButton.addEventListener('click', resetPicker);
saveButton.addEventListener('click', saveResult);
saveOriginalButton.addEventListener('click', saveOriginal);
shareButton.addEventListener('click', shareResult);
openResultButton.addEventListener('click', openLightbox);
closeLightboxButton.addEventListener('click', closeLightbox);
resultLightbox.addEventListener('click', (event) => {
  if (event.target === resultLightbox) closeLightbox();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !resultLightbox.hidden) closeLightbox();
});

renderSavedDrawings();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
