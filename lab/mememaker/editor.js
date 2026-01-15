const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

let img = null;

function wrapText(ctx, text, maxWidth, charSpacing) {
  const words = text.split(/\n/);
  const lines = [];
  for (const w of words) {
    let line = [],
      width = 0;
    for (let i = 0; i < w.length; i++) {
      const ch = w[i],
        wCh = ctx.measureText(ch).width + charSpacing;
      if (width + wCh > maxWidth && line.length > 0) {
        lines.push(line);
        line = [ch];
        width = wCh;
      } else {
        line.push(ch);
        width += wCh;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawLine(ctx, line, xCenter, y, charSpacing) {
  let totalWidth =
    line.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
    charSpacing * (line.length - 1);
  let x = xCenter - totalWidth / 2;
  for (const ch of line) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + charSpacing;
  }
}

function redraw() {
  if (!img) {
    canvas.width = 500;
    canvas.height = 400;
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.fillText("请上传图片", 210, 200);
    return;
  }

  const fontSize = +$("fontSize").value;
  const fontFamily = $("fontFamily").value;
  const lineSpacing = +$("lineSpacing").value;
  const charSpacing = +$("charSpacing").value;
  const padTop = +$("padTop").value;
  const padBottom = +$("padBottom").value;
  const padX = +$("padX").value;
  const position = $("position").value;

  const texts = [$("text1").value, $("text2").value];
  ctx.font = `${fontSize}px ${fontFamily}`;

  const linesWrapped = texts.map((t) =>
    wrapText(ctx, t, img.width - 2 * padX, charSpacing)
  );
  let textBlockH =
    linesWrapped.reduce(
      (acc, lines) => acc + lines.length * (fontSize + lineSpacing),
      0
    ) -
    lineSpacing +
    padTop +
    padBottom;

  canvas.width = img.width;
  canvas.height = img.height + (position.startsWith("out") ? textBlockH : 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bgColor = position.startsWith("out")
    ? $("bgColor").value
    : "transparent";
  ctx.fillStyle = bgColor;
  if (position.startsWith("out"))
    ctx.fillRect(
      0,
      position.endsWith("top") ? 0 : img.height,
      canvas.width,
      textBlockH
    );

  let imgY = position.startsWith("out-top") ? textBlockH : 0;
  ctx.drawImage(img, 0, imgY, img.width, img.height);

  if ($("invert").checked || $("grayscale").checked) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
      let r = data.data[i],
        g = data.data[i + 1],
        b = data.data[i + 2];
      if ($("grayscale").checked) {
        const gray = (r + g + b) / 3;
        r = g = b = gray;
      }
      if ($("invert").checked) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }
      data.data[i] = r;
      data.data[i + 1] = g;
      data.data[i + 2] = b;
    }
    ctx.putImageData(data, 0, 0);
  }

  ctx.fillStyle = $("textColor").value;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = `${fontSize}px ${fontFamily}`;

  let baseY = 0;
  if (position.startsWith("out-top")) baseY = padTop;
  else if (position.startsWith("out-bottom")) baseY = img.height + padTop;
  else if (position.startsWith("in-top")) baseY = padTop;
  else if (position.startsWith("in-bottom"))
    baseY = img.height - textBlockH + padTop;

  linesWrapped.forEach((lines) => {
    lines.forEach((line) => {
      drawLine(ctx, line, canvas.width / 2, baseY, charSpacing);
      baseY += fontSize + lineSpacing;
    });
  });
}

$("imageInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    img = new Image();
    img.onload = redraw;
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

[
  "text1",
  "text2",
  "fontSize",
  "fontFamily",
  "lineSpacing",
  "charSpacing",
  "padTop",
  "padBottom",
  "padX",
  "position",
  "textColor",
  "bgColor",
  "invert",
  "grayscale",
].forEach((id) => {
  $(id).addEventListener("input", redraw);
});

$("syncBg").onclick = () => {
  if (!img) return;
  const tmp = document.createElement("canvas");
  tmp.width = img.width;
  tmp.height = 3;
  const tmpCtx = tmp.getContext("2d");
  tmpCtx.drawImage(img, 0, img.height - 3, img.width, 3, 0, 0, img.width, 3);
  const data = tmpCtx.getImageData(0, 0, tmp.width, tmp.height).data;
  const map = {};
  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    map[key] = (map[key] || 0) + 1;
  }
  const color = Object.entries(map).sort((a, b) => b[1] - a[1])[0][0];
  $("bgColor").value = `rgb(${color})`;
  redraw();
};

function save(format) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL(`image/${format}`);
  a.download = `emoji.${format}`;
  a.click();
}
$("savePng").onclick = () => save("png");
$("saveJpg").onclick = () => save("jpeg");

$("reset").onclick = () => {
  $("text1").value = "";
  $("text2").value = "";
  $("fontSize").value = 32;
  $("fontFamily").value = "SimHei,STHeiti,Microsoft YaHei,sans-serif";
  $("textColor").value = "#ffffff";
  $("bgColor").value = "#000000";
  $("lineSpacing").value = 8;
  $("charSpacing").value = 2;
  $("padTop").value = 10;
  $("padBottom").value = 10;
  $("padX").value = 10;
  $("position").value = "out-bottom";
  $("invert").checked = false;
  $("grayscale").checked = false;
  $("imageInput").value = null;
  img = null;
  redraw();
};

redraw();
