const el = (id) => document.getElementById(id);
const canvas = el("canvas");
const ctx = canvas.getContext("2d");
const statusEl = el("status");

let loaded = []; // array of HTMLImageElement

function setStatus(m){ statusEl.textContent = m; }

function readFiles(files){
  loaded = [];
  const arr = Array.from(files || []);
  return Promise.all(arr.map(f => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(f);
  }))).then(imgs => {
    loaded = imgs;
  });
}

function drawHeader(text){
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,canvas.width,200);
  ctx.fillStyle = "#111";
  ctx.font = "bold 52px -apple-system, system-ui, Segoe UI, Roboto, Arial";
  ctx.fillText(text || "Report", 60, 110);
  ctx.fillStyle = "#555";
  ctx.font = "32px -apple-system, system-ui, Segoe UI, Roboto, Arial";
  ctx.fillText(new Date().toLocaleString(), 60, 160);
}

function drawImageCover(img, x, y, w, h){
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const r = Math.max(w/iw, h/ih);
  const nw = iw*r, nh = ih*r;
  const dx = x + (w - nw)/2;
  const dy = y + (h - nh)/2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 24);
  ctx.clip();
  ctx.drawImage(img, dx, dy, nw, nh);
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function clear(){
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function render(){
  clear();
  const layout = el("layout").value;
  const header = el("header").value.trim();
  drawHeader(header);

  const pad = 40;
  const top = 240;
  const W = canvas.width;
  const H = canvas.height;

  const contentX = pad;
  const contentY = top;
  const contentW = W - pad*2;
  const contentH = H - top - pad;

  const imgs = loaded;

  if (!imgs.length){
    setStatus("Pick some photos first.");
    return;
  }

  if (layout === "3"){
    // 1 large + 2 small
    const bigH = Math.floor(contentH * 0.60);
    const smallH = contentH - bigH - pad;
    drawImageCover(imgs[0], contentX, contentY, contentW, bigH);
    const halfW = Math.floor((contentW - pad)/2);
    if (imgs[1]) drawImageCover(imgs[1], contentX, contentY + bigH + pad, halfW, smallH);
    if (imgs[2]) drawImageCover(imgs[2], contentX + halfW + pad, contentY + bigH + pad, halfW, smallH);
  }

  if (layout === "4"){
    // 2x2
    const cellW = Math.floor((contentW - pad)/2);
    const cellH = Math.floor((contentH - pad)/2);
    if (imgs[0]) drawImageCover(imgs[0], contentX, contentY, cellW, cellH);
    if (imgs[1]) drawImageCover(imgs[1], contentX + cellW + pad, contentY, cellW, cellH);
    if (imgs[2]) drawImageCover(imgs[2], contentX, contentY + cellH + pad, cellW, cellH);
    if (imgs[3]) drawImageCover(imgs[3], contentX + cellW + pad, contentY + cellH + pad, cellW, cellH);
  }

  if (layout === "1+3"){
    // top big + 3 across
    const bigH = Math.floor(contentH * 0.55);
    drawImageCover(imgs[0], contentX, contentY, contentW, bigH);
    const rowY = contentY + bigH + pad;
    const cellW = Math.floor((contentW - pad*2)/3);
    const cellH = contentY + contentH - rowY;
    if (imgs[1]) drawImageCover(imgs[1], contentX, rowY, cellW, cellH);
    if (imgs[2]) drawImageCover(imgs[2], contentX + cellW + pad, rowY, cellW, cellH);
    if (imgs[3]) drawImageCover(imgs[3], contentX + (cellW + pad)*2, rowY, cellW, cellH);
  }

  el("downloadBtn").disabled = false;
  setStatus("Rendered. Download to save/share.");
}

function download(){
  const name = (el("header").value.trim() || "report")
    .replace(/[^a-z0-9\- _]/gi,"")
    .replace(/\s+/g," ")
    .trim();
  const a = document.createElement("a");
  a.download = `${name} - ${new Date().toISOString().slice(0,10)}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

el("picker").addEventListener("change", async (e) => {
  setStatus("Loading photos…");
  await readFiles(e.target.files);
  setStatus(`${loaded.length} photo(s) loaded.`);
  el("downloadBtn").disabled = true;
});

el("renderBtn").addEventListener("click", render);
el("downloadBtn").addEventListener("click", download);

setStatus("Ready.");
