const { getCurrentWindow, LogicalSize } = window.__TAURI__.window;
const { register, isRegistered, unregister } =
  window.__TAURI_PLUGIN_GLOBAL_SHORTCUT__;
const { readImage, writeImage } = window.__TAURI_PLUGIN_CLIPBOARDMANAGER__;

const tauriWindow = getCurrentWindow();

if (await isRegistered("CommandOrControl+Shift+Q")) {
  await unregister("CommandOrControl+Shift+Q");
}

await register("CommandOrControl+Shift+Q", async (event) => {
  if (event.state === "Pressed" && !(await tauriWindow.isVisible())) {
    await tauriWindow.center();
    await tauriWindow.show();
    await tauriWindow.setFocus();

    load_clipboard_image();
  }
});

window.addEventListener("keydown", async (event) => {
  if (!(await tauriWindow.isVisible())) {
    return;
  }

  if (event.key === "Escape") {
    tauriWindow.hide();
  } else if (event.key === "Enter" || event.key === "d") {
    copyImageToClipboard();
  } else if (event.key === "c") {
    currentTool = "censor";
  } else if (event.key === "x") {
    currentTool = "blur";
  } else if (event.key === "z") {
    currentTool = "pixelate";
  }
});

let currentTool = "censor";
let isDrawing = false;

let drawOrigin = { x: 0, y: 0 };

const drawings = [];

const canvas = document.querySelector("canvas");
canvas.width = 0;
canvas.height = 0;

const ctx = canvas.getContext("2d");

const toolbar = document.querySelector(".toolbar");

const image = new Image();

image.onload = () => {
  canvas.width = image.width;
  canvas.height = image.height;

  tauriWindow.setSize(
    new LogicalSize(image.width, image.height + toolbar.clientHeight)
  );

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
};

canvas.addEventListener("mousedown", (event) => {
  isDrawing = true;
  drawOrigin = { x: event.offsetX, y: event.offsetY };
});

canvas.addEventListener("mousemove", (event) => {
  if (isDrawing) {
    draw(event);
  }
});

canvas.addEventListener("mouseup", (event) => {
  isDrawing = false;

  const x = Math.min(drawOrigin.x, event.offsetX);
  const y = Math.min(drawOrigin.y, event.offsetY);
  const width = Math.abs(drawOrigin.x - event.offsetX);
  const height = Math.abs(drawOrigin.y - event.offsetY);

  drawings.push({ type: currentTool, x, y, width, height });

  draw();
});

function draw(event) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  for (const drawing of drawings) {
    if (drawing.type === "censor") {
      ctx.fillStyle = "black";
      ctx.fillRect(drawing.x, drawing.y, drawing.width, drawing.height);
    }
  }

  if (isDrawing && event) {
    const x = Math.min(drawOrigin.x, event.offsetX);
    const y = Math.min(drawOrigin.y, event.offsetY);
    const width = Math.abs(drawOrigin.x - event.offsetX);
    const height = Math.abs(drawOrigin.y - event.offsetY);

    if (currentTool === "censor") {
      ctx.fillStyle = "black";
      ctx.fillRect(x, y, width, height);
    }
  }
}

async function copyImageToClipboard() {
  canvas.toBlob(async (blob) => {
    // const item = new ClipboardItem({ [blob.type]: blob });
    // navigator.clipboard.write([item]);

    try {
      await writeImage(await blob.arrayBuffer());

      tauriWindow.hide();
    } catch (error) {
      console.error(error);
      alert("Error copying image to clipboard");
    }
  }, "image/png");
}

async function load_clipboard_image() {
  const clipboard = await readImage();

  const blob = new Blob([await clipboard.rgba()], { type: "image" });

  const reader = new FileReader();

  reader.onload = () => {
    image.src = reader.result;
  };

  reader.readAsDataURL(blob);
}

document
  .querySelector("#censor")
  .addEventListener("click", () => (currentTool = "censor"));
document
  .querySelector("#blur")
  .addEventListener("click", () => (currentTool = "blur"));
document
  .querySelector("#pixelate")
  .addEventListener("click", () => (currentTool = "pixelate"));
document.querySelector("#copy").addEventListener("click", copyImageToClipboard);

load_clipboard_image();
