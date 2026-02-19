const el = (id) => document.getElementById(id);
const gridEl = el("grid");
const statusEl = el("status");
const pickerEl = el("picker");
const templateEl = el("template");
const exportBtn = el("exportBtn");
const resetBtn = el("resetBtn");
const swapBtn = el("swapBtn");
const exportCanvas = el("exportCanvas");
const ctx = exportCanvas.getContext("2d");

let photos = []; // array of { img: HTMLImageElement, w, h }
let cells = [];  // array of cell state { photoIndex, scale, tx, ty }
let swapMode = false;
let selectedCellIndex = null;

function setStatus(msg) { statusEl.textContent = msg; }

function templateSpec(value){
  // rows, cols, count, aspect 1:1 stage
  switch(value){
    case "2v": return { rows: 2, cols: 1, count: 2 };
    case "2h": return { rows: 1, cols: 2, count: 2 };
    case "3v": return { rows: 3, cols: 1, count: 3 };
    case "3h": return { rows: 1, cols: 3, count: 3 };
    case "2x2": return { rows: 2, cols: 2, count: 4 };
    case "2x3": return { rows: 2, cols: 3, count: 6 };
    case "3x3": return { rows: 3, cols: 3, count: 9 };
    default: return { rows: 2, cols: 2, count: 4 };
  }
}

function initCells(){
  const spec = templateSpec(templateEl.value);
  cells = Array.from({length: spec.count}, (_, i) => ({
    photoIndex: i < photos.length ? i : null,
    scale: 1,
    tx: 0,
    ty: 0
  }));
}

function renderGrid(){
  const spec = templateSpec(templateEl.value);
  gridEl.style.gridTemplateRows = `repeat(${spec.rows}, 1fr)`;
  gridEl.style.gridTemplateColumns = `repeat(${spec.cols}, 1fr)`;
  gridEl.innerHTML = "";
  selectedCellIndex = null;

  cells.forEach((state, idx) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.idx = String(idx);

    if (state.photoIndex == null || !photos[state.photoIndex]) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Tap to add photo";
      cell.appendChild(hint);
    } else {
      const img = photos[state.photoIndex].img.cloneNode(true);
      img.draggable = false;
      applyTransform(img, state);
      cell.appendChild(img);
    }

    // Tap behavior: either select for swap or assign photo if empty
    cell.addEventListener("click", () => onCellTap(idx, cell));
    attachPanZoomHandlers(cell, idx);

    gridEl.appendChild(cell);
  });

  const hasAny = cells.some(c => c.photoIndex != null);
  exportBtn.disabled = !hasAny;
  resetBtn.disabled = !hasAny;
  swapBtn.disabled = !hasAny;
}

function applyTransform(imgEl, state){
  imgEl.style.transform = `translate(calc(-50% + ${state.tx}px), calc(-50% + ${state.ty}px)) scale(${state.scale})`;
}

async function loadFiles(fileList){
  const files = Array.from(fileList || []);
  if (!files.length) return;

  setStatus("Loading photos…");
  const imgs = await Promise.all(files.map(f => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(f);
  })));

  photos = imgs.map(img => ({ img, w: img.naturalWidth, h: img.naturalHeight }));
  initCells();
  renderGrid();
  setStatus(`${photos.length} photo(s) loaded.`);
}

// ---------- Swap mode ----------
function toggleSwap(){
  swapMode = !swapMode;
  selectedCellIndex = null;
  swapBtn.textContent = `Swap mode: ${swapMode ? "ON" : "OFF"}`;
  document.querySelectorAll(".cell").forEach(c => c.classList.remove("selected"));
}

function onCellTap(idx, cellEl){
  // If cell empty: do nothing (you can just re-pick photos with correct order for v1)
  // Layout app allowed per-frame picking; we’ll keep v1 simple.
  if (!swapMode) return;

  if (selectedCellIndex == null) {
    selectedCellIndex = idx;
    cellEl.classList.add("selected");
    return;
  }

  if (selectedCellIndex === idx) {
    selectedCellIndex = null;
    cellEl.classList.remove("selected");
    return;
  }

  // swap photo assignment + reset framing (matches “Layout” feel)
  const a = selectedCellIndex;
  const b = idx;

  const tmp = cells[a].photoIndex;
  cells[a].photoIndex = cells[b].photoIndex;
  cells[b].photoIndex = tmp;

  cells[a].scale = 1; cells[a].tx = 0; cells[a].ty = 0;
  cells[b].scale = 1; cells[b].tx = 0; cells[b].ty = 0;

  selectedCellIndex = null;
  renderGrid();
  setStatus("Swapped.");
}

// ---------- Pan/zoom (touch + pointer) ----------
function attachPanZoomHandlers(cellEl, idx){
  let pointers = new Map(); // pointerId -> {x,y}
  let start = null;

  const getImg = () => cellEl.querySelector("img");

  cellEl.addEventListener("pointerdown", (e) => {
    if (swapMode) return;
    const img = getImg();
    if (!img) return;

    cellEl.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});

    if (pointers.size === 1) {
      start = {
        tx: cells[idx].tx,
        ty: cells[idx].ty,
        scale: cells[idx].scale,
        x: e.clientX,
        y: e.clientY
      };
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      start = {
        tx: cells[idx].tx,
        ty: cells[idx].ty,
        scale: cells[idx].scale,
        dist
      };
    }
  });

  cellEl.addEventListener("pointermove", (e) => {
    if (swapMode) return;
    const img = getImg();
    if (!img) return;
    if (!pointers.has(e.pointerId) || !start) return;

    pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});

    if (pointers.size === 1) {
      // pan
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      cells[idx].tx = start.tx + dx;
      cells[idx].ty = start.ty + dy;
      applyTransform(img, cells[idx]);
    } else if (pointers.size === 2) {
      // pinch zoom
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      const ratio = dist / start.dist;
      const next = clamp(start.scale * ratio, 1, 4);
      cells[idx].scale = next;
      applyTransform(img, cells[idx]);
    }
  });

  function endPointer(e){
    if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);
    if (pointers.size === 0) start = null;

    // If one pointer remains, reset start reference for smooth continuation
    if (pointers.size === 1) {
      const pt = Array.from(pointers.values())[0];
      start = { tx: cells[idx].tx, ty: cells[idx].ty, scale: cells[idx].scale, x: pt.x, y: pt.y };
    }
  }

  cellEl.addEventListener("pointerup", endPointer);
  cellEl.addEventListener("pointercancel", endPointer);
}

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// ---------- Reset framing ----------
function resetFraming(){
  cells.forEach(c => { c.scale = 1; c.tx = 0; c.ty = 0; });
  renderGrid();
  setStatus("Framing reset.");
}

// ---------- Export (render to canvas using transforms) ----------
function exportImage(){
  const stageSize = exportCanvas.width; // square
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,stageSize,stageSize);

  const spec = templateSpec(templateEl.value);
  const pad = 12;  // inner padding like UI
  const gap = 12;

  const inner = stageSize - pad*2;
  const cellW = (inner - gap*(spec.cols-1)) / spec.cols;
  const cellH = (inner - gap*(spec.rows-1)) / spec.rows;

  // Helper: draw image "cover" into cell rect, then apply user pan/zoom
  cells.forEach((state, i) => {
    if (state.photoIndex == null || !photos[state.photoIndex]) return;

    const r = Math.floor(i / spec.cols);
    const c = i % spec.cols;

    const x = pad + c*(cellW + gap);
    const y = pad + r*(cellH + gap);
    const w = cellW;
    const h = cellH;

    // rounded rect clip
    roundRectClip(ctx, x, y, w, h, 32);

    const img = photos[state.photoIndex].img;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // Base "cover" scale to fill cell
    const base = Math.max(w/iw, h/ih);

    // User scale multiplies base
    const s = base * state.scale;

    const drawW = iw * s;
    const drawH = ih * s;

    // Center in cell, then apply tx/ty (in CSS pixels) scaled to export canvas space
    // Our stage is 2048px; the on-screen stage is unknown, but transforms are proportional enough for “Layout” feel.
    // We map tx/ty roughly by scaling relative to cell size:
    const tx = state.tx * (w / 320); // heuristic
    const ty = state.ty * (h / 320); // heuristic

    const dx = x + (w - drawW)/2 + tx;
    const dy = y + (h - drawH)/2 + ty;

    ctx.drawImage(img, dx, dy, drawW, drawH);

    ctx.restore();
    // thin border
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
  });

  const url = exportCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.download = `collage-${new Date().toISOString().slice(0,10)}.png`;
  a.href = url;
  a.click();
  setStatus("Exported.");
}

function roundRectClip(ctx, x, y, w, h, r){
  ctx.save();
  ctx.beginPath();
  const rr = Math.min(r, w/2, h/2);
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
  ctx.clip();
}

// ---------- events ----------
pickerEl.addEventListener("change", async (e) => {
  await loadFiles(e.target.files);
});

templateEl.addEventListener("change", () => {
  initCells();
  renderGrid();
  setStatus("Template changed.");
});

swapBtn.addEventListener("click", toggleSwap);
resetBtn.addEventListener("click", resetFraming);
exportBtn.addEventListener("click", exportImage);

// init
initCells();
renderGrid();
setStatus("Ready.");
