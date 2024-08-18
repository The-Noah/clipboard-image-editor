const BLUR_AMOUNT = 2;
const BLUR_STRENGTH = 3;
const PIXEL_SIZE = 8;

const { getCurrentWindow, LogicalSize } = window.__TAURI__.window;
const { register, isRegistered, unregister } =
  window.__TAURI_PLUGIN_GLOBAL_SHORTCUT__;
const { readImage, writeImage } = window.__TAURI_PLUGIN_CLIPBOARDMANAGER__;

const tauriWindow = getCurrentWindow();

const censorButton = document.querySelector("#censor");
const pixelateButton = document.querySelector("#pixelate");
const blurButton = document.querySelector("#blur");

if (await isRegistered("Super+Shift+Q")) {
  await unregister("Super+Shift+Q");
}

await register("Super+Shift+Q", async (event) => {
  if (event.state === "Pressed" && !(await tauriWindow.isVisible())) {
    await tauriWindow.center();
    await tauriWindow.show();
    await tauriWindow.setFocus();

    loadClipboardImage();
  }
});

let currentTool = "censor";
let isDrawing = false;

let drawOrigin = { x: 0, y: 0 };

const drawings = [];

window.addEventListener("keydown", async (event) => {
  if (!(await tauriWindow.isVisible())) {
    return;
  }

  if (event.key === "Escape") {
    tauriWindow.hide();
  } else if (
    event.key === "Enter" ||
    event.key === "d" ||
    (event.ctrlKey && event.key === "c")
  ) {
    copyImageToClipboard();
  } else if (event.ctrlKey && event.key === "v") {
    loadClipboardImage();
  } else if (event.ctrlKey && event.key === "z") {
    drawings.pop();
    draw();
  } else if (event.key === "z") {
    censorButton.click();
  } else if (event.key === "x") {
    blurButton.click();
  } else if (event.key === "c") {
    pixelateButton.click();
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
  if (drawing.type === "censor") {
    ctx.fillStyle = "black";
    ctx.fillRect(drawing.x, drawing.y, drawing.width, drawing.height);
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
  }
}

async function copyImageToClipboard() {
  canvas.toBlob(async (blob) => {
    try {
      await writeImage(await blob.arrayBuffer());

      tauriWindow.hide();
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

  reader.onload = () => {
    image.src = reader.result;
  };

  reader.readAsDataURL(blob);
}

censor.addEventListener("click", (event) => {
  currentTool = "censor";

  censorButton.removeAttribute("data-active");
  pixelateButton.removeAttribute("data-active");
  blurButton.removeAttribute("data-active");

  event.target.toggleAttribute("data-active");
});

blurButton.addEventListener("click", (event) => {
  currentTool = "blur";

  censorButton.removeAttribute("data-active");
  pixelateButton.removeAttribute("data-active");
  blurButton.removeAttribute("data-active");

  event.target.toggleAttribute("data-active");
});

pixelateButton.addEventListener("click", () => {
  currentTool = "pixelate";

  censorButton.removeAttribute("data-active");
  pixelateButton.removeAttribute("data-active");
  blurButton.removeAttribute("data-active");

  event.target.toggleAttribute("data-active");
});

document.querySelector("#copy").addEventListener("click", copyImageToClipboard);

censorButton.click();

loadClipboardImage();
