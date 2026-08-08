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
const againButton = document.querySelector('#againButton');
const errorView = document.querySelector('#errorView');
const errorMessage = document.querySelector('#errorMessage');
const retryButton = document.querySelector('#retryButton');
const confetti = document.querySelector('#confetti');

let selectedFile = null;
let selectedDataUrl = '';
let generatedDataUrl = '';
let loadingTimer = null;

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

function resetPicker() {
  selectedFile = null;
  selectedDataUrl = '';
  generatedDataUrl = '';
  cameraInput.value = '';
  galleryInput.value = '';
  drawingPreview.removeAttribute('src');
  emptyState.hidden = false;
  selectedState.hidden = true;
  showOnly(pickerView);
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

  const maxSide = 1600;
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

  return canvas.toDataURL('image/jpeg', 0.88);
}

async function selectImage(file) {
  try {
    selectedFile = file;
    selectedDataUrl = await prepareImage(file);
    drawingPreview.src = selectedDataUrl;
    emptyState.hidden = true;
    selectedState.hidden = false;
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
    resultOriginal.src = selectedDataUrl;
    resultImage.src = generatedDataUrl;
    stopLoadingMessages();
    showOnly(resultView);
    celebrate();
  } catch (error) {
    showError(error.message || 'Não consegui transformar esse desenho agora.');
  } finally {
    transformButton.disabled = false;
  }
}

function saveImage() {
  if (!generatedDataUrl) return;
  const link = document.createElement('a');
  link.href = generatedDataUrl;
  link.download = `desenho-real-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

cameraInput.addEventListener('change', (event) => selectImage(event.target.files?.[0]));
galleryInput.addEventListener('change', (event) => selectImage(event.target.files?.[0]));
transformButton.addEventListener('click', transformDrawing);
changeImageButton.addEventListener('click', () => galleryInput.click());
retryButton.addEventListener('click', transformDrawing);
againButton.addEventListener('click', resetPicker);
saveButton.addEventListener('click', saveImage);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
