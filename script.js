const tierBoard = document.querySelector("#tier-board");
const itemPool = document.querySelector("#item-pool");
const itemForm = document.querySelector("#item-form");
const itemInput = document.querySelector("#item-input");
const imageForm = document.querySelector("#image-form");
const imageInput = document.querySelector("#image-input");
const imageFileName = document.querySelector("#image-file-name");
const tierForm = document.querySelector("#tier-form");
const tierInput = document.querySelector("#tier-input");
const titleInput = document.querySelector("#title-input");
const boardTitle = document.querySelector("#board-title");
const exportImage = document.querySelector("#export-image");
const copyTemplate = document.querySelector("#copy-template");
const resetList = document.querySelector("#reset-list");
const status = document.querySelector("#status");
const exportCanvas = document.querySelector("#export-canvas");

const colors = ["#ff5c7a", "#ffcf5c", "#e9ff70", "#54ff84", "#7fb7ff", "#d78cff", "#f5f5f0"];

let state = {
  title: "official ranking",
  tiers: ["S", "A", "B", "C", "D"],
  items: [],
};

let draggedId = null;

function createId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function encodeState() {
  const compact = {
    title: state.title,
    tiers: state.tiers,
    items: state.items.map(({ type, text, src }) => ({ type, text, src })),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
}

function loadTemplate() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get("template");
  if (!data) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(data))));
    state = {
      title: parsed.title || state.title,
      tiers: Array.isArray(parsed.tiers) && parsed.tiers.length ? parsed.tiers : state.tiers,
      items: (Array.isArray(parsed.items) ? parsed.items : []).map((item) => ({
        id: createId(),
        type: typeof item === "string" ? "text" : item.type || "text",
        text: typeof item === "string" ? item : item.text || "image item",
        src: typeof item === "string" ? "" : item.src || "",
        tier: null,
      })),
    };
  } catch {
    status.textContent = "Template link could not be loaded.";
  }
}

function updateUrl() {
  const params = new URLSearchParams({ template: encodeState() });
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function createItemElement(item) {
  const element = document.createElement("div");
  element.className = `item item-${item.type || "text"}`;
  element.draggable = true;
  element.dataset.id = item.id;
  if (item.type === "image" && item.src) {
    const image = document.createElement("img");
    image.src = item.src;
    image.alt = item.text || "tier item";
    element.append(image);
  } else {
    element.textContent = item.text;
  }
  element.addEventListener("dragstart", (event) => {
    draggedId = item.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    const ghost = element.cloneNode(true);
    ghost.classList.add("drag-ghost");
    document.body.append(ghost);
    event.dataTransfer.setDragImage(ghost, 36, 36);
    requestAnimationFrame(() => ghost.remove());
  });
  element.addEventListener("dragend", () => {
    draggedId = null;
  });
  element.addEventListener("dblclick", () => {
    state.items = state.items.filter((entry) => entry.id !== item.id);
    render();
  });
  return element;
}

function addDropEvents(zone, tier) {
  zone.ondragover = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    zone.classList.add("drag-over");
  };
  zone.ondragleave = () => zone.classList.remove("drag-over");
  zone.ondrop = (event) => {
    event.preventDefault();
    zone.classList.remove("drag-over");
    const item = state.items.find((entry) => entry.id === draggedId);
    if (!item) return;
    item.tier = tier;
    render();
  };
}

function render() {
  boardTitle.textContent = state.title;
  titleInput.value = state.title;
  tierBoard.replaceChildren(
    ...state.tiers.map((tier, index) => {
      const row = document.createElement("section");
      row.className = "tier-row";
      row.innerHTML = `
        <div class="tier-label" style="--tier-color: ${colors[index % colors.length]}">${tier}</div>
        <div class="drop-zone" data-tier="${tier}"></div>
        <div class="tier-actions">
          <button class="mini-button" type="button" data-action="up">↑</button>
          <button class="mini-button" type="button" data-action="down">↓</button>
          <button class="mini-button" type="button" data-action="delete">x</button>
        </div>
      `;
      const zone = row.querySelector(".drop-zone");
      addDropEvents(zone, tier);
      zone.replaceChildren(...state.items.filter((item) => item.tier === tier).map(createItemElement));
      row.querySelector('[data-action="up"]').addEventListener("click", () => moveTier(index, -1));
      row.querySelector('[data-action="down"]').addEventListener("click", () => moveTier(index, 1));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteTier(tier));
      return row;
    }),
  );

  itemPool.replaceChildren(...state.items.filter((item) => item.tier === null).map(createItemElement));
  addDropEvents(itemPool, null);
}

function moveTier(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= state.tiers.length) return;
  [state.tiers[index], state.tiers[next]] = [state.tiers[next], state.tiers[index]];
  render();
}

function deleteTier(tier) {
  state.tiers = state.tiers.filter((item) => item !== tier);
  state.items.forEach((item) => {
    if (item.tier === tier) item.tier = null;
  });
  render();
}

function fitText(ctx, text, maxWidth, startSize, minSize, weight = 900) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
    if (ctx.measureText(String(text)).width <= maxWidth) return size;
    size -= 2;
  } while (size >= minSize);
  return minSize;
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("load", () => {
        const maxSize = 420;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      });
      image.addEventListener("error", reject);
      image.src = reader.result;
    });
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function loadCanvasImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => resolve(null));
    image.src = src;
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function drawExport() {
  const exportItems = await Promise.all(
    state.items.map(async (item) => ({
      ...item,
      image: item.type === "image" && item.src ? await loadCanvasImage(item.src) : null,
    })),
  );
  const ctx = exportCanvas.getContext("2d");
  ctx.fillStyle = "#030303";
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  for (let x = 0; x <= exportCanvas.width; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, exportCanvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= exportCanvas.height; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(exportCanvas.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#e9ff70";
  ctx.font = "900 26px Inter, Arial, sans-serif";
  ctx.fillText("TIER LIST", 72, 86);
  ctx.fillStyle = "#f5f5f0";
  fitText(ctx, state.title, 1100, 78, 42, 900);
  ctx.fillText(state.title, 72, 168);

  const rowH = Math.min(160, Math.max(104, Math.floor(1120 / state.tiers.length)));
  let y = 240;
  state.tiers.forEach((tier, index) => {
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    roundRect(ctx, 72, y, 1256, rowH - 10, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.stroke();

    ctx.fillStyle = colors[index % colors.length];
    roundRect(ctx, 72, y, 120, rowH - 10, 18);
    ctx.fill();
    ctx.fillStyle = "#11120e";
    fitText(ctx, tier, 86, 56, 26, 950);
    ctx.fillText(tier, 112, y + rowH / 2 + 18);

    const items = exportItems.filter((item) => item.tier === tier);
    items.forEach((item, itemIndex) => {
      const x = 216 + (itemIndex % 5) * 214;
      const itemY = y + 16 + Math.floor(itemIndex / 5) * 54;
      if (itemY > y + rowH - 58) return;
      if (item.type === "image" && item.image) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        roundRect(ctx, x, itemY - 4, 64, 50, 10);
        ctx.fill();
        const scale = Math.max(64 / item.image.width, 50 / item.image.height);
        const imageW = item.image.width * scale;
        const imageH = item.image.height * scale;
        ctx.save();
        roundRect(ctx, x, itemY - 4, 64, 50, 10);
        ctx.clip();
        ctx.drawImage(item.image, x + (64 - imageW) / 2, itemY - 4 + (50 - imageH) / 2, imageW, imageH);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(233,255,112,0.12)";
        roundRect(ctx, x, itemY, 196, 42, 10);
        ctx.fill();
        ctx.fillStyle = "#f5f5f0";
        fitText(ctx, item.text, 170, 22, 12, 820);
        ctx.fillText(item.text, x + 12, itemY + 28);
      }
    });
    y += rowH;
  });

  ctx.fillStyle = "#f5f5f0";
  ctx.font = "900 38px Inter, Arial, sans-serif";
  ctx.fillText("jakublabs.xyz", 72, 1510);

  const link = document.createElement("a");
  link.href = exportCanvas.toDataURL("image/png");
  link.download = "tier-list.png";
  link.click();
}

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = itemInput.value.trim();
  if (!text) return;
  state.items.push({ id: createId(), type: "text", text, src: "", tier: null });
  itemInput.value = "";
  render();
});

imageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = imageInput.files?.[0];
  if (!file) {
    status.textContent = "Choose an image first.";
    return;
  }
  const src = await readImageFile(file);
  state.items.push({ id: createId(), type: "image", text: file.name.replace(/\.[^.]+$/, ""), src, tier: null });
  imageInput.value = "";
  imageFileName.textContent = "Choose Image";
  status.textContent = "Image item added.";
  render();
});

imageInput.addEventListener("change", () => {
  imageFileName.textContent = imageInput.files?.[0]?.name || "Choose Image";
});

tierForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const tier = tierInput.value.trim();
  if (!tier || state.tiers.includes(tier)) return;
  state.tiers.push(tier);
  tierInput.value = "";
  render();
});

titleInput.addEventListener("input", () => {
  state.title = titleInput.value.trim() || "official ranking";
  render();
});

copyTemplate.addEventListener("click", async () => {
  const url = updateUrl();
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = "Template link copied.";
  } catch {
    status.textContent = url;
  }
});

exportImage.addEventListener("click", drawExport);

resetList.addEventListener("click", () => {
  window.location.href = window.location.pathname;
});

loadTemplate();
render();
