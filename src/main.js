const BLUR_AMOUNT = 2;
const BLUR_STRENGTH = 4;
const PIXEL_SIZE = 8;

const { invoke } = window.__TAURI__.core;
const { getCurrentWindow, LogicalSize } = window.__TAURI__.window;
const { register, isRegistered, unregister } =
  window.__TAURI_PLUGIN_GLOBAL_SHORTCUT__;
const { readImage, writeImage } = window.__TAURI_PLUGIN_CLIPBOARDMANAGER__;

const tauriWindow = getCurrentWindow();

tauriWindow.listen("reset", () => {
  reset();
});

tauriWindow.listen("load", () => {
  loadClipboardImage();
});

const cropButton = document.querySelector("#crop");
const censorButton = document.querySelector("#censor");
const pixelateButton = document.querySelector("#pixelate");
const blurButton = document.querySelector("#blur");
const rectangleButton = document.querySelector("#rectangle");

if (await isRegistered("Super+Shift+Q")) {
  await unregister("Super+Shift+Q");
}

await register("Super+Shift+Q", async (event) => {
  if (event.state === "Pressed" && !(await tauriWindow.isVisible())) {
    await reset();
    await loadClipboardImage();

    await tauriWindow.center();
    await tauriWindow.show();
    await tauriWindow.setFocus();
  }
});

let currentTool = "crop";
let isDrawing = false;

let drawOrigin = { x: 0, y: 0 };

const drawings = [];
const redoBuffer = [];

window.addEventListener("keydown", async (event) => {
  if (!(await tauriWindow.isVisible())) {
    return;
  }

  if (event.key === "Escape") {
    invoke("hide_window");
  } else if (
    event.key === "Enter" ||
    event.key === "d" ||
    (event.ctrlKey && event.key === "c")
  ) {
    copyImageToClipboard();
  } else if (event.ctrlKey && event.key === "v") {
    loadClipboardImage();
  } else if (
    (event.ctrlKey && event.key === "y") ||
    (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z")
  ) {
    const drawing = redoBuffer.pop();

    if (drawing) {
      drawings.push(drawing);
      draw();
    }
  } else if (event.ctrlKey && event.key === "z") {
    redoBuffer.push(drawings.pop());
    draw();
  } else if (event.ctrlKey && event.key === "r") {
    resetEdits();
    event.preventDefault();
  } else if (event.key === "c") {
    cropButton.click();
  } else if (event.key === "z") {
    censorButton.click();
  } else if (event.key === "x") {
    blurButton.click();
  } else if (event.key === "p") {
    pixelateButton.click();
  } else if (event.key === "r") {
    rectangleButton.click();
  }
});

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
    new LogicalSize(
      Math.max(300, image.width),
      Math.max(200, image.height + toolbar.clientHeight)
    )
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

  if (width === 0 || height === 0) {
    return;
  }

  if (currentTool === "crop") {
    const cropped = ctx.getImageData(x, y, width, height);

    drawings.push({
      type: currentTool,
      x,
      y,
      width,
      height,
      metadata: {
        cropped,
      },
    });
  } else {
    drawings.push({ type: currentTool, x, y, width, height });
  }

  redoBuffer.length = 0;

  draw();
});

function draw(event) {
  const { cropped } =
    drawings.findLast((drawing) => drawing.type === "crop")?.metadata || {};

  const { width, height } = cropped ?? image;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;

    tauriWindow.setSize(
      new LogicalSize(
        Math.max(300, width),
        Math.max(200, height + toolbar.clientHeight)
      )
    );
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (cropped) {
    ctx.putImageData(cropped, 0, 0);
  } else {
    ctx.drawImage(image, 0, 0);
  }

  for (const drawing of drawings) {
    drawEffect(drawing);
  }

  if (isDrawing && event) {
    const x = Math.min(drawOrigin.x, event.offsetX);
    const y = Math.min(drawOrigin.y, event.offsetY);
    const width = Math.abs(drawOrigin.x - event.offsetX);
    const height = Math.abs(drawOrigin.y - event.offsetY);

    const drawing = { type: currentTool, x, y, width, height };

    drawEffect(drawing);
  }
}

function drawEffect(drawing) {
  if (drawing.type === "crop" && !drawing.metadata) {
    ctx.fillStyle = "black";
    ctx.globalAlpha = 0.5;

    ctx.fillRect(0, 0, canvas.width, drawing.y);
    ctx.fillRect(0, drawing.y, drawing.x, drawing.height);
    ctx.fillRect(
      drawing.x + drawing.width,
      drawing.y,
      canvas.width,
      drawing.height
    );
    ctx.fillRect(0, drawing.y + drawing.height, canvas.width, canvas.height);

    ctx.globalAlpha = 1;
  } else if (drawing.type === "censor") {
    ctx.fillStyle = "black";

    ctx.beginPath();
    ctx.roundRect(drawing.x, drawing.y, drawing.width, drawing.height, 4);
    ctx.fill();
    ctx.closePath();
  } else if (drawing.type === "blur") {
    for (let i = 0; i < BLUR_STRENGTH; i++) {
      ctx.filter = `blur(${BLUR_AMOUNT}px)`;
      ctx.drawImage(
        canvas,
        drawing.x,
        drawing.y,
        drawing.width,
        drawing.height,
        drawing.x,
        drawing.y,
        drawing.width,
        drawing.height
      );
      ctx.filter = "none";
    }
  } else if (drawing.type === "pixelate") {
    for (let x = drawing.x; x < drawing.x + drawing.width; x += PIXEL_SIZE) {
      for (let y = drawing.y; y < drawing.y + drawing.height; y += PIXEL_SIZE) {
        const pixel = ctx.getImageData(x, y, PIXEL_SIZE, PIXEL_SIZE);

        for (let i = 0; i < pixel.data.length; i += 4) {
          const r = pixel.data[i];
          const g = pixel.data[i + 1];
          const b = pixel.data[i + 2];

          for (let j = 0; j < PIXEL_SIZE; j++) {
            for (let k = 0; k < PIXEL_SIZE; k++) {
              const index = i + j * PIXEL_SIZE * 4 + k * 4;

              pixel.data[index] = r;
              pixel.data[index + 1] = g;
              pixel.data[index + 2] = b;
            }
          }
        }

        ctx.putImageData(pixel, x, y);
      }
    }
  } else if (drawing.type === "rectangle") {
    ctx.strokeStyle = "#f00";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(drawing.x, drawing.y, drawing.width, drawing.height, 4);
    ctx.stroke();
    ctx.closePath();
  }
}

function copyImageToClipboard() {
  canvas.toBlob(async (blob) => {
    try {
      await writeImage(await blob.arrayBuffer());

      invoke("hide_window");
    } catch (error) {
      console.error(error);
      alert("Error copying image to clipboard");
    }
  }, "image/png");
}

async function loadClipboardImage() {
  const clipboard = await readImage();

  const blob = new Blob([await clipboard.rgba()], { type: "image" });

  const reader = new FileReader();

  return new Promise((resolve) => {
    reader.onload = () => {
      image.src = reader.result;
      resolve();
    };

    reader.readAsDataURL(blob);
  });
}

function resetEdits() {
  drawings.length = 0;
  redoBuffer.length = 0;

  draw();
}

async function reset() {
  image.src = "";
  isDrawing = false;

  resetEdits();
  cropButton.click();
}

function toolButtonClicked(event) {
  currentTool = event.currentTarget.id;

  for (const button of document.querySelectorAll(".toolbar > button")) {
    button.removeAttribute("data-active");
  }

  event.currentTarget.toggleAttribute("data-active");
}

cropButton.addEventListener("click", toolButtonClicked);
censorButton.addEventListener("click", toolButtonClicked);
blurButton.addEventListener("click", toolButtonClicked);
pixelateButton.addEventListener("click", toolButtonClicked);
rectangleButton.addEventListener("click", toolButtonClicked);

document.querySelector("#reset-edits").addEventListener("click", resetEdits);
document.querySelector("#copy").addEventListener("click", copyImageToClipboard);
