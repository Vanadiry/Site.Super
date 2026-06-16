const $ = id => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const canvasWrap = document.querySelector('.canvas-wrap');
const layerList = $('layerList');
const propsPanel = $('propsPanel');
const propsContent = $('propsContent');
const sidebar = $('sidebar');
const sidebarTab = $('sidebarTab');
const resizeHandle = $('resizeHandle');

let CANVAS_W = 500, CANVAS_H = 500;
const PAD = 200;
let layers = [], selectedId = null, nextId = 1;
let dragging = false, dragStartX, dragStartY, dragOrigX, dragOrigY;
let panning = false, panStartX, panStartY, panOrigScrollX, panOrigScrollY;
let canvasManual = false, lockRatio = false, canvasRatio = CANVAS_W / CANVAS_H;
let history = [], historyIdx = -1;
function saveHistory() {
    history = history.slice(0, historyIdx + 1);
    history.push({ layers: JSON.parse(JSON.stringify(layers)), W: CANVAS_W, H: CANVAS_H });
    if (history.length > 50) history.shift();
    historyIdx = history.length - 1;
}
function undo() {
    if (historyIdx <= 0) return;
    historyIdx--;
    restoreHistory();
}
function redo() {
    if (historyIdx >= history.length - 1) return;
    historyIdx++;
    restoreHistory();
}
function restoreHistory() {
    const s = history[historyIdx];
    CANVAS_W = s.W; CANVAS_H = s.H; resizeCanvas();
    $('canvasW').value = CANVAS_W; $('canvasH').value = CANVAS_H;
    layers = s.layers.map(l => {
        if (l.type === 'image') { l.img = null; l._cache = null; }
        return l;
    });
    selectedId = null; updatePanel(); render(); applyZoom();
}
function duplicateLayer() {
    const sel = layers.find(l => l.id === selectedId);
    if (!sel) return;
    const copy = JSON.parse(JSON.stringify(sel));
    copy.id = nextId++; copy.x += 10; copy.y += 10;
    if (sel.type === 'image') { copy.img = sel.img; copy._cache = null; }
    layers.push(copy); selectLayer(layers.length - 1); saveHistory(); render();
}

function resizeCanvas() {
    cv.width = CANVAS_W + PAD * 2;
    cv.height = CANVAS_H + PAD * 2;
}
resizeCanvas();

// ===== 侧栏 =====
sidebarTab.addEventListener('click', () => {
    sidebar.classList.remove('hidden');
    sidebar.style.width = '300px';
    sidebar.classList.remove('wide');
    sidebarTab.style.display = 'none';
    applyZoom();
});

let resizing = false;
resizeHandle.addEventListener('mousedown', e => {
    resizing = true; resizeHandle.classList.add('active'); e.preventDefault();
});
document.addEventListener('mousemove', e => {
    if (!resizing) return;
    const maxW = 600;
    let w = window.innerWidth - e.clientX;
    if (w < 160) {
        sidebar.classList.add('hidden');
        sidebar.style.width = '300px';
        sidebarTab.style.display = 'flex';
    } else {
        sidebar.classList.remove('hidden');
        sidebarTab.style.display = 'none';
        w = Math.max(200, Math.min(w, maxW));
        sidebar.style.width = w + 'px';
    }
    applyZoom();
});
document.addEventListener('mouseup', () => {
    resizing = false;
    resizeHandle.classList.remove('active');
});

// ===== 画布尺寸 & 锁定比例 =====
function setCanvasSize(w, h, manual) {
    CANVAS_W = Math.round(w); CANVAS_H = Math.round(h);
    if (lockRatio && canvasRatio > 0) canvasRatio = w / h;
    resizeCanvas();
    $('canvasW').value = CANVAS_W; $('canvasH').value = CANVAS_H;
    if (manual) canvasManual = true;
    applyZoom(); render();
}
$('canvasW').addEventListener('input', () => {
    if (lockRatio) $('canvasH').value = Math.round((+$('canvasW').value || 1) / canvasRatio);
});
$('canvasH').addEventListener('input', () => {
    if (lockRatio) $('canvasW').value = Math.round((+$('canvasH').value || 1) * canvasRatio);
});
$('lockRatio').addEventListener('click', () => {
    lockRatio = !lockRatio;
    $('lockRatio').classList.toggle('on', lockRatio);
    if (lockRatio) canvasRatio = CANVAS_W / CANVAS_H;
});
['anchorTop', 'anchorBottom', 'anchorLeft', 'anchorRight'].forEach(id => {
    $(id).addEventListener('click', () => $(id).classList.toggle('on'));
});
$('confirmCanvas').addEventListener('click', () => {
    const oldW = CANVAS_W, oldH = CANVAS_H;
    const newW = +$('canvasW').value || 500, newH = +$('canvasH').value || 500;
    const dw = newW - oldW, dh = newH - oldH;

    const t = $('anchorTop').classList.contains('on');
    const b = $('anchorBottom').classList.contains('on');
    const l = $('anchorLeft').classList.contains('on');
    const r = $('anchorRight').classList.contains('on');

    const dx = Math.round((l && r) || (!l && !r) ? dw / 2 : l ? dw : 0);
    const dy = Math.round((t && b) || (!t && !b) ? dh / 2 : t ? dh : 0);

    setCanvasSize(newW, newH, true);
    for (const layer of layers) { layer.x = Math.round(layer.x + dx); layer.y = Math.round(layer.y + dy); }
    if (+$('zoomPct').value === -1) applyZoom();
    saveHistory(); render();
});

// ===== 预览缩放 =====
function getContentBounds() {
    let minX = 0, minY = 0, maxX = CANVAS_W, maxY = CANVAS_H;
    for (const l of layers) {
        const sz = getLayerSize(l);
        const s = l.scale / 100;
        const hw = sz.w / 2 * s, hh = sz.h / 2 * s;
        minX = Math.min(minX, l.x - hw); minY = Math.min(minY, l.y - hh);
        maxX = Math.max(maxX, l.x + hw); maxY = Math.max(maxY, l.y + hh);
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function applyZoom() {
    let z = +$('zoomPct').value;
    if (z === -1 || isNaN(z)) {
        const area = canvasWrap.getBoundingClientRect();
        const b = getContentBounds();
        const tw = Math.max(b.w, CANVAS_W) + PAD * 2;
        const th = Math.max(b.h, CANVAS_H) + PAD * 2;
        z = Math.min((area.width - 40) / tw, (area.height - 40) / th, 1);
    } else {
        z = z / 100;
    }
    cv.style.width = Math.round((CANVAS_W + PAD * 2) * z) + 'px';
    cv.style.height = Math.round((CANVAS_H + PAD * 2) * z) + 'px';
}
$('zoomPct').addEventListener('input', applyZoom);
window.addEventListener('resize', () => { if (+$('zoomPct').value === -1) applyZoom(); });

// 溢出红色虚线 & 边界实线辉光
let dashOffset = 0;
function drawOverflowBorder() {
    const b = getContentBounds();
    const inCanvas = b.minX >= 0 && b.minY >= 0 && b.maxX <= CANVAS_W && b.maxY <= CANVAS_H;
    const inBuffer = b.minX >= -PAD && b.minY >= -PAD && b.maxX <= CANVAS_W + PAD && b.maxY <= CANVAS_H + PAD;
    if (inCanvas) return false;

    ctx.save();
    ctx.translate(PAD, PAD);

    if (!inBuffer) {
        // 超出缓冲区：实线 + 辉光
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.setLineDash([]);
        ctx.strokeRect(-PAD, -PAD, CANVAS_W + PAD * 2, CANVAS_H + PAD * 2);
        ctx.shadowBlur = 0;
    }

    // 画布边界虚线
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.shadowColor = inBuffer ? 'transparent' : '#ef4444';
    ctx.shadowBlur = inBuffer ? 0 : 6;
    ctx.setLineDash([8, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.restore();
    return true;
}
(function animOverflow() {
    if (layers.length > 0) {
        dashOffset = (dashOffset + 0.5) % 12;
        const b = getContentBounds();
        if (b.minX < 0 || b.minY < 0 || b.maxX > CANVAS_W || b.maxY > CANVAS_H) {
            render(); drawOverflowBorder();
        }
    }
    requestAnimationFrame(animOverflow);
})();
$('zoomPct').addEventListener('input', applyZoom);

// ===== 图层 =====
function newLayer(type, overrides) {
    const base = { id: nextId++, type, label: '', x: CANVAS_W / 2, y: CANVAS_H / 2, rotation: 0, scale: 100, opacity: 100, radius: 0, flipH: false, flipV: false, invert: false, grayscale: false, locked: false, visible: true };
    if (type === 'text')
        return Object.assign(base, { text: '文本', font: 'SimHei,STHeiti,sans-serif', fontSize: 40, color: '#ffffff', strokeColor: '#000000', strokeWidth: 3, bold: false, italic: false }, overrides);
    if (type === 'shape')
        return Object.assign(base, { shapeType: 'rect', shapeW: 100, shapeH: 80, fillColor: '#3b82f6', strokeColor: '#1d4ed8', strokeWidth: 2 }, overrides);
    return Object.assign(base, { img: null, naturalW: 0, naturalH: 0 }, overrides);
}

function addShapeLayer(type) {
    layers.push(newLayer('shape', { shapeType: type }));
    selectLayer(layers.length - 1); saveHistory(); render();
}

function addTextLayer() { layers.push(newLayer('text')); selectLayer(layers.length - 1); saveHistory(); render(); }

function addImageLayer(file) {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            if (layers.length === 0 && !canvasManual) {
                canvasRatio = img.width / img.height;
                setCanvasSize(img.width, img.height, false);
                if (lockRatio) canvasRatio = img.width / img.height;
            }
            layers.push(newLayer('image', { img, naturalW: img.width, naturalH: img.height, scale: 100, x: CANVAS_W / 2, y: CANVAS_H / 2 }));
            selectLayer(layers.length - 1); saveHistory(); render();
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function selectLayer(idx) { selectedId = layers[idx] ? layers[idx].id : null; updatePanel(); render(); }
function deleteLayer(id) {
    saveHistory();
    layers = layers.filter(l => l.id !== id);
    if (selectedId === id) selectedId = layers.length ? layers[layers.length - 1].id : null;
    updatePanel(); render();
}
function moveLayer(idx, dir) {
    const ni = idx + dir; if (ni < 0 || ni >= layers.length) return;
    saveHistory();
    [layers[idx], layers[ni]] = [layers[ni], layers[idx]]; updatePanel(); render();
}

// ===== 渲染 =====
function render() {
    const cw = cv.width, ch = cv.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, cw, ch);
    ctx.clearRect(PAD, PAD, CANVAS_W, CANVAS_H);
    ctx.save(); ctx.translate(PAD, PAD);
    for (const l of layers) {
        if (!l.visible) continue;
        ctx.save(); ctx.translate(l.x, l.y);
        const s = l.scale / 100;
        ctx.rotate(l.rotation * Math.PI / 180);
        ctx.scale(l.flipH ? -s : s, l.flipV ? -s : s);
        ctx.globalAlpha = (l.opacity ?? 100) / 100;
        if (l.invert || l.grayscale) {
            const sz = getLayerSize(l);
            if (!l._cache || l._cache.w !== sz.w || l._cache.h !== sz.h) {
                l._cache = { w: sz.w, h: sz.h, canvas: document.createElement('canvas') };
                l._cache.canvas.width = sz.w;
                l._cache.canvas.height = sz.h;
            }
            const oc = l._cache.canvas.getContext('2d');
            oc.clearRect(0, 0, sz.w, sz.h);
            oc.save(); oc.translate(sz.w / 2, sz.h / 2); drawLayerContent(oc, l); oc.restore();
            const idata = oc.getImageData(0, 0, sz.w, sz.h);
            const d = idata.data;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] > 0) {
                    if (l.grayscale) { const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = d[i + 1] = d[i + 2] = g; }
                    if (l.invert) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
                }
            }
            oc.putImageData(idata, 0, 0);
            ctx.drawImage(l._cache.canvas, -sz.w / 2, -sz.h / 2);
        } else { drawLayerContent(ctx, l); }
        ctx.restore();
        if (l.id === selectedId) drawSelectionBox(l);
    }
    ctx.restore();
    if (!render.skipDecorations) drawOverflowBorder();
}

function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawLayerContent(ctx, l) {
    if (l.type === 'text') {
        const weight = l.bold ? 'bold ' : '';
        const style = l.italic ? 'italic ' : '';
        ctx.font = `${style}${weight}${l.fontSize}px ${l.font}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (l.strokeWidth > 0) { ctx.strokeStyle = l.strokeColor; ctx.lineWidth = l.strokeWidth; ctx.lineJoin = 'round'; ctx.strokeText(l.text, 0, 0); }
        ctx.fillStyle = l.color; ctx.fillText(l.text, 0, 0);
    } else if (l.type === 'shape') {
        const hw = l.shapeW / 2, hh = l.shapeH / 2, r = l.radius || 0;
        ctx.fillStyle = l.fillColor;
        ctx.strokeStyle = l.strokeColor;
        ctx.lineWidth = l.strokeWidth;
        ctx.beginPath();
        if (l.shapeType === 'ellipse') ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
        else if (r > 0) roundRect(ctx, -hw, -hh, l.shapeW, l.shapeH, r);
        else ctx.rect(-hw, -hh, l.shapeW, l.shapeH);
        ctx.fill();
        if (l.strokeWidth > 0) ctx.stroke();
    } else if (l.img) {
        if ((l.radius || 0) > 0) {
            ctx.save();
            const hw = l.naturalW / 2, hh = l.naturalH / 2;
            roundRect(ctx, -hw, -hh, l.naturalW, l.naturalH, l.radius);
            ctx.clip();
            ctx.drawImage(l.img, -hw, -hh, l.naturalW, l.naturalH);
            ctx.restore();
        } else {
            ctx.drawImage(l.img, -l.naturalW / 2, -l.naturalH / 2, l.naturalW, l.naturalH);
        }
    }
}

function getLayerSize(l) {
    if (l.type === 'shape') return { w: l.shapeW + l.strokeWidth * 2, h: l.shapeH + l.strokeWidth * 2 };
    if (l.type === 'text') {
        ctx.save(); ctx.font = `bold ${l.fontSize}px ${l.font}`;
        const m = ctx.measureText(l.text || ' '); ctx.restore();
        const pad = l.strokeWidth + 6;
        return { w: Math.ceil(m.width + pad * 2), h: Math.ceil(l.fontSize * 1.4 + pad * 2) };
    }
    return { w: l.naturalW, h: l.naturalH };
}

function drawSelectionBox(l) {
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rotation * Math.PI / 180);
    const s = l.scale / 100; ctx.scale(s, s);
    const sz = getLayerSize(l);
    ctx.strokeStyle = l.locked ? '#f87171' : '#3b82f6';
    ctx.lineWidth = 2.5 / s;
    ctx.shadowColor = l.locked ? '#f87171' : '#3b82f6';
    ctx.shadowBlur = 6 / s;
    ctx.setLineDash([8 / s, 3 / s]); ctx.strokeRect(-sz.w / 2, -sz.h / 2, sz.w, sz.h);
    ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.restore();
}

// ===== 交互 =====
function getEventPos(e) {
    if (e.touches) return { cx: e.touches[0].clientX, cy: e.touches[0].clientY };
    return { cx: e.clientX, cy: e.clientY };
}
function onPointerDown(e) {
    e.preventDefault();
    const { cx, cy } = getEventPos(e);
    const { mx, my } = mousePos({ clientX: cx, clientY: cy });
    const hit = hitTest(mx, my);
    if (hit !== null) {
        selectLayer(hit); dragging = true;
        dragStartX = mx; dragStartY = my;
        dragOrigX = layers[hit].x; dragOrigY = layers[hit].y;
    } else {
        selectedId = null; updatePanel(); render();
        panning = true;
        panStartX = cx; panStartY = cy;
        panOrigScrollX = canvasWrap.scrollLeft; panOrigScrollY = canvasWrap.scrollTop;
    }
}
function onPointerMove(e) {
    e.preventDefault();
    const { cx, cy } = getEventPos(e);
    if (dragging) {
        const { mx, my } = mousePos({ clientX: cx, clientY: cy });
        const l = layers.find(l => l.id === selectedId);
        if (l) {
            l.x = dragOrigX + (mx - dragStartX); l.y = dragOrigY + (my - dragStartY);
            render();
            const px = $('propX'), py = $('propY');
            if (px) px.value = Math.round(l.x);
            if (py) py.value = Math.round(l.y);
        }
    } else if (panning) {
        canvasWrap.scrollLeft = panOrigScrollX - (cx - panStartX);
        canvasWrap.scrollTop = panOrigScrollY - (cy - panStartY);
    }
}
function onPointerUp() { if (dragging) saveHistory(); dragging = false; panning = false; }
cv.addEventListener('mousedown', e => onPointerDown(e));
cv.addEventListener('mousemove', e => onPointerMove(e));
document.addEventListener('mouseup', onPointerUp);
cv.addEventListener('touchstart', e => onPointerDown(e), { passive: false });
cv.addEventListener('touchmove', e => onPointerMove(e), { passive: false });
document.addEventListener('touchend', onPointerUp);

function mousePos(e) {
    const r = cv.getBoundingClientRect();
    return { mx: (e.clientX - r.left) * (cv.width / r.width) - PAD, my: (e.clientY - r.top) * (cv.height / r.height) - PAD };
}

function hitTest(mx, my) {
    for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i];
        if (l.locked || !l.visible) continue;
        const dx = mx - l.x, dy = my - l.y;
        const a = -l.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
        const rx = (dx * cos - dy * sin) / (l.scale / 100), ry = (dx * sin + dy * cos) / (l.scale / 100);
        const sz = getLayerSize(l);
        if (Math.abs(rx) <= sz.w / 2 && Math.abs(ry) <= sz.h / 2) return i;
    }
    return null;
}

// ===== 面板 =====
function updatePanel() {
    layerList.innerHTML = layers.map((l, i) => {
        const defName = l.type === 'text' ? (l.text.slice(0, 8) || '文字') : l.type === 'shape' ? (l.shapeType === 'ellipse' ? '椭圆' : '矩形') : '图片';
        const label = (l.label || defName) + ' #' + l.id;
        return `<div class="layer-item${l.id === selectedId ? ' active' : ''}" draggable="true" data-idx="${i}">
            <span class="act" data-up="${i}">↑</span><span class="act" data-dn="${i}">↓</span>
            <span class="dot ${l.type === 'shape' ? 'shape' : l.type}"></span>
            <span class="name" data-idx="${i}" title="${label}">${label}</span>
            <span class="act" data-copy="${i}">C</span>
            <span class="act" data-eye="${i}">${l.visible ? 'V' : 'H'}</span>
            <span class="act lock-act${l.locked ? ' on' : ''}" data-lock="${i}">锁</span>
            <span class="del" data-del="${i}">×</span>
        </div>`;
    }).join('');

    layerList.querySelectorAll('.layer-item').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.classList.contains('del') || e.target.classList.contains('act')) return;
            selectLayer(+el.dataset.idx);
        });
    });
    layerList.querySelectorAll('.del').forEach(el =>
        el.addEventListener('click', e => { e.stopPropagation(); deleteLayer(layers[+el.dataset.del].id); }));
    layerList.querySelectorAll('.act[data-lock]').forEach(el =>
        el.addEventListener('click', e => { e.stopPropagation(); const l = layers[+el.dataset.lock]; l.locked = !l.locked; updatePanel(); render(); }));
    layerList.querySelectorAll('.act[data-copy]').forEach(el =>
        el.addEventListener('click', e => { e.stopPropagation(); selectedId = layers[+el.dataset.copy].id; duplicateLayer(); }));
    layerList.querySelectorAll('.act[data-eye]').forEach(el =>
        el.addEventListener('click', e => { e.stopPropagation(); const l = layers[+el.dataset.eye]; l.visible = !l.visible; saveHistory(); updatePanel(); render(); }));
    layerList.querySelectorAll('.act[data-up]').forEach(el =>
        el.addEventListener('click', e => { e.stopPropagation(); moveLayer(+el.dataset.up, -1); }));
    layerList.querySelectorAll('.act[data-dn]').forEach(el =>
        el.addEventListener('click', e => { e.stopPropagation(); moveLayer(+el.dataset.dn, 1); }));

    let dragIdx = -1, dragAfter = false;
    function clearDragMarks() {
        layerList.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-before', 'drag-after'));
    }
    layerList.querySelectorAll('.layer-item').forEach(el => {
        el.addEventListener('dragstart', e => { dragIdx = +el.dataset.idx; el.style.opacity = '0.4'; });
        el.addEventListener('dragend', e => { el.style.opacity = ''; clearDragMarks(); });
        el.addEventListener('dragover', e => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            dragAfter = (e.clientY - rect.top) > rect.height / 2;
            clearDragMarks();
            el.classList.add(dragAfter ? 'drag-after' : 'drag-before');
            if (dragAfter && el.nextElementSibling) el.nextElementSibling.classList.add('drag-before');
            if (!dragAfter && el.previousElementSibling) el.previousElementSibling.classList.add('drag-after');
        });
        el.addEventListener('dragleave', e => {
            if (!el.contains(e.relatedTarget)) el.classList.remove('drag-before', 'drag-after');
        });
        el.addEventListener('drop', e => {
            e.preventDefault(); clearDragMarks();
            let toIdx = +el.dataset.idx;
            if (dragAfter) toIdx++;
            if (dragIdx >= 0 && dragIdx !== toIdx && dragIdx !== toIdx - 1) {
                const [moved] = layers.splice(dragIdx, 1);
                const insertAt = dragIdx < toIdx ? toIdx - 1 : toIdx;
                layers.splice(insertAt, 0, moved);
                saveHistory(); updatePanel(); render();
            }
        });
    });

    const sel = layers.find(l => l.id === selectedId);
    if (!sel) { propsPanel.style.display = 'none'; return; }
    propsPanel.style.display = 'block';

    let html = `<div class="field-row"><div class="field"><label>X</label><input type="number" id="propX" value="${Math.round(sel.x)}"></div><div class="field"><label>Y</label><input type="number" id="propY" value="${Math.round(sel.y)}"></div></div>`;
    html += `<div class="field-row"><div class="field"><label>旋转 (°)</label><input type="number" id="propRot" value="${sel.rotation}"></div><div class="field"><label>缩放 (%)</label><input type="number" id="propScale" value="${sel.scale}" min="1"></div></div>`;
    html += `<div class="field-row"><div class="field"><label>透明度</label><input type="number" id="propOpacity" value="${sel.opacity ?? 100}" min="0" max="100"></div><div class="field"><label>圆角</label><input type="number" id="propRadius" value="${sel.radius || 0}" min="0"></div></div>`;
    html += `<div class="field"><label>颜色</label><div class="btn-row">
        <button class="toggle-btn${sel.invert ? ' on' : ''}" id="propInvert">反色</button>
        <button class="toggle-btn${sel.grayscale ? ' on' : ''}" id="propGrayscale">黑白</button>
    </div></div>`;
    if (sel.type === 'shape') {
        html += `<div class="field-row"><div class="field"><label>宽</label><input type="number" id="propShapeW" value="${sel.shapeW}" min="1"></div><div class="field"><label>高</label><input type="number" id="propShapeH" value="${sel.shapeH}" min="1"></div></div>`;
        html += `<div class="field-row"><div class="field"><label>填充色</label><input type="color" id="propFillColor" value="${sel.fillColor}"></div><div class="field"><label>描边色</label><input type="color" id="propStrokeColor" value="${sel.strokeColor}"></div></div>`;
        html += `<div class="field-row"><div class="field"><label>描边宽</label><input type="number" id="propShapeStrokeW" value="${sel.strokeWidth}" min="0"></div><div class="field"></div></div>`;
    }
    html += `<div class="field-row"><div class="field"><label>水平方向</label><div class="btn-row">
        <button class="toggle-btn${sel.flipH ? ' on' : ''}" id="propFlipH">翻转</button>
        <button class="align-btn" id="propAlignHC">居中</button><button class="align-btn" id="propFitW">适应</button><button class="align-btn" id="propFillW">填充</button>
    </div></div></div>`;
    html += `<div class="field-row"><div class="field"><label>垂直方向</label><div class="btn-row">
        <button class="toggle-btn${sel.flipV ? ' on' : ''}" id="propFlipV">翻转</button>
        <button class="align-btn" id="propAlignVC">居中</button><button class="align-btn" id="propFitH">适应</button><button class="align-btn" id="propFillH">填充</button>
    </div></div></div>`;
    if (sel.type === 'text') {
        html += `<div class="field"><label>文字内容</label><textarea id="propText">${sel.text}</textarea></div>`;
        html += `<div class="field-row"><div class="field"><button class="toggle-btn${sel.bold ? ' on' : ''}" id="propBold">粗体</button></div><div class="field"><button class="toggle-btn${sel.italic ? ' on' : ''}" id="propItalic">斜体</button></div></div>`;
        html += `<div class="field-row"><div class="field"><label>字体</label><select id="propFont">
            <option value="SimHei,STHeiti,sans-serif" ${sel.font.startsWith('SimHei') ? 'selected' : ''}>黑体</option>
            <option value="STKaiti,KaiTi,serif" ${sel.font.startsWith('STKaiti') ? 'selected' : ''}>楷体</option>
            <option value="SimSun,Songti,serif" ${sel.font.startsWith('SimSun') ? 'selected' : ''}>宋体</option>
            <option value="Arial,sans-serif" ${sel.font.startsWith('Arial') ? 'selected' : ''}>Arial</option>
        </select></div><div class="field"><label>字号</label><input type="number" id="propFontSize" value="${sel.fontSize}" min="8"></div><div class="field"><label>文字颜色</label><input type="color" id="propColor" value="${sel.color}"></div></div>`;
        html += `<div class="field-row"><div class="field"><label>描边宽度</label><input type="number" id="propStrokeW" value="${sel.strokeWidth}" min="0"></div><div class="field"><label>描边颜色</label><input type="color" id="propStrokeC" value="${sel.strokeColor}"></div></div>`;
    }
    html += `<div class="field"><label>图层名称</label><input type="text" id="propLabel" value="${sel.label || ''}" placeholder="${sel.type === 'text' ? (sel.text.slice(0, 8) || '文字') : sel.type === 'shape' ? (sel.shapeType === 'ellipse' ? '椭圆' : '矩形') : '图片'}"></div>`;
    propsContent.innerHTML = html;
    if (sel.locked) {
        propsContent.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
    } else {
        bindProps(sel);
    }
}

function bindProps(sel) {
    const b = (id, prop, fn) => {
        const el = $(id); if (!el) return;
        el.addEventListener('input', () => { sel[prop] = fn ? fn(el) : (el.type === 'checkbox' ? el.checked : el.value); render(); });
        el.addEventListener('blur', () => { saveHistory(); });
    };
    b('propX', 'x', el => +el.value || 0); b('propY', 'y', el => +el.value || 0);
    b('propRot', 'rotation', el => +el.value || 0); b('propScale', 'scale', el => +el.value || 1);
    b('propOpacity', 'opacity', el => Math.min(100, Math.max(0, +el.value ?? 100)));
    b('propRadius', 'radius', el => Math.max(0, +el.value || 0));
    const fhBtn = $('propFlipH'); if (fhBtn) fhBtn.addEventListener('click', () => { sel.flipH = !sel.flipH; fhBtn.classList.toggle('on', sel.flipH); render(); });
    const fvBtn = $('propFlipV'); if (fvBtn) fvBtn.addEventListener('click', () => { sel.flipV = !sel.flipV; fvBtn.classList.toggle('on', sel.flipV); render(); });
    const invBtn = $('propInvert');
    if (invBtn) invBtn.addEventListener('click', () => { sel.invert = !sel.invert; invBtn.classList.toggle('on', sel.invert); render(); });
    const grayBtn = $('propGrayscale');
    if (grayBtn) grayBtn.addEventListener('click', () => { sel.grayscale = !sel.grayscale; grayBtn.classList.toggle('on', sel.grayscale); render(); });
    const labelInput = $('propLabel');
    if (labelInput) labelInput.addEventListener('blur', () => { sel.label = labelInput.value; updatePanel(); });

    let natW, natH;
    if (sel.type === 'image') { natW = sel.naturalW; natH = sel.naturalH; }
    else {
        ctx.save(); ctx.font = `bold ${sel.fontSize}px ${sel.font}`;
        natW = ctx.measureText(sel.text || ' ').width;
        natH = sel.fontSize * 1.2;
        ctx.restore();
        natW /= (sel.scale / 100); natH /= (sel.scale / 100);
    }
    const align = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { fn(); render(); updatePanel(); applyZoom(); }); };
    align('propAlignHC', () => { sel.x = CANVAS_W / 2; });
    align('propAlignVC', () => { sel.y = CANVAS_H / 2; });
    align('propFitW', () => { sel.scale = CANVAS_W / natW * 100; sel.x = CANVAS_W / 2; });
    align('propFitH', () => { sel.scale = CANVAS_H / natH * 100; sel.y = CANVAS_H / 2; });
    align('propFillW', () => { sel.scale = CANVAS_W / natW * 100; sel.x = CANVAS_W / 2; sel.y = CANVAS_H / 2; });
    align('propFillH', () => { sel.scale = CANVAS_H / natH * 100; sel.x = CANVAS_W / 2; sel.y = CANVAS_H / 2; });

    if (sel.type === 'shape') {
        b('propShapeW', 'shapeW', el => +el.value || 1);
        b('propShapeH', 'shapeH', el => +el.value || 1);
        b('propFillColor', 'fillColor', el => el.value);
        b('propStrokeColor', 'strokeColor', el => el.value);
        b('propShapeStrokeW', 'strokeWidth', el => +el.value || 0);
    }
    if (sel.type === 'text') {
        b('propText', 'text', el => el.value); b('propFont', 'font', el => el.value);
        b('propFontSize', 'fontSize', el => +el.value || 8); b('propStrokeW', 'strokeWidth', el => +el.value || 0);
        b('propColor', 'color', el => el.value); b('propStrokeC', 'strokeColor', el => el.value);
        const bB = $('propBold'); if (bB) bB.addEventListener('click', () => { sel.bold = !sel.bold; bB.classList.toggle('on', sel.bold); render(); });
        const bI = $('propItalic'); if (bI) bI.addEventListener('click', () => { sel.italic = !sel.italic; bI.classList.toggle('on', sel.italic); render(); });
    }
}

// ===== 按钮 =====
sidebar.addEventListener('click', e => {
    if (e.target.classList.contains('collapse-btn')) {
        e.target.closest('.panel-section').classList.toggle('collapsed');
    }
});
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const sel = layers.find(l => l.id === selectedId); if (sel) { deleteLayer(sel.id); saveHistory(); } }
});
$('deselDot').addEventListener('click', () => { selectedId = null; updatePanel(); render(); });
$('btnAddText').addEventListener('click', addTextLayer);
$('btnAddImage').addEventListener('click', () => $('fileInput').click());
$('btnAddRect').addEventListener('click', () => addShapeLayer('rect'));
$('btnAddEllipse').addEventListener('click', () => addShapeLayer('ellipse'));
canvasArea.addEventListener('dragover', e => { e.preventDefault(); });
canvasArea.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) addImageLayer(f); });
$('fileInput').addEventListener('change', e => { if (e.target.files[0]) addImageLayer(e.target.files[0]); e.target.value = ''; });

function exportImage(format) {
    const s = parseFloat($('exportScale').value) || 1;
    const quality = Math.min(100, Math.max(1, +$('exportQuality').value || 70)) / 100;
    const W = Math.max(1, Math.round(CANVAS_W * s)), H = Math.max(1, Math.round(CANVAS_H * s));
    const savedId = selectedId; selectedId = null;
    render.skipDecorations = true; render();
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const tc = tmp.getContext('2d');
    if (format === 'jpeg') { tc.fillStyle = '#fff'; tc.fillRect(0, 0, W, H); }
    tc.drawImage(cv, PAD, PAD, CANVAS_W, CANVAS_H, 0, 0, W, H);
    selectedId = savedId; render.skipDecorations = false; render();
    const a = document.createElement('a');
    a.download = `webps.${format}`;
    a.href = format === 'jpeg' ? tmp.toDataURL('image/jpeg', quality) : tmp.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
let resetPending = false;
$('btnReset').addEventListener('click', () => {
    if (!resetPending) {
        resetPending = true;
        $('btnReset').textContent = '确认重置？';
        $('btnReset').style.background = '#7f1d1d';
        setTimeout(() => { if (resetPending) { resetPending = false; $('btnReset').textContent = '重置'; $('btnReset').style.background = '#991b1b'; } }, 3000);
        return;
    }
    resetPending = false;
    $('btnReset').textContent = '重置';
    $('btnReset').style.background = '#991b1b';
    layers = []; selectedId = null; nextId = 1;
    canvasManual = false; lockRatio = false;
    setCanvasSize(500, 500, false);
    canvasRatio = 1;
    $('lockRatio').classList.remove('on');
    ['anchorTop', 'anchorBottom', 'anchorLeft', 'anchorRight'].forEach(id => $(id).classList.remove('on'));
    updatePanel(); render();
});
$('exportFormat').addEventListener('change', updateExportUI);
function updateExportUI() { $('exportQualityRow').style.display = $('exportFormat').value === 'jpeg' ? '' : 'none'; }
updateExportUI();
$('btnSave').addEventListener('click', () => exportImage($('exportFormat').value));

// 项目导入导出
$('btnExport').addEventListener('click', () => {
    const data = {
        version: 1,
        name: $('projectName').value.trim() || 'project',
        createdAt: new Date().toISOString(),
        canvas: { width: CANVAS_W, height: CANVAS_H },
        layers: layers.map(l => {
        const o = { id: l.id, type: l.type, label: l.label, x: l.x, y: l.y, rotation: l.rotation, scale: l.scale, opacity: l.opacity, radius: l.radius, flipH: l.flipH, flipV: l.flipV, invert: l.invert, grayscale: l.grayscale, locked: l.locked, visible: l.visible };
        if (l.type === 'text') Object.assign(o, { text: l.text, font: l.font, fontSize: l.fontSize, color: l.color, strokeColor: l.strokeColor, strokeWidth: l.strokeWidth, bold: l.bold, italic: l.italic });
        else if (l.type === 'shape') Object.assign(o, { shapeType: l.shapeType, shapeW: l.shapeW, shapeH: l.shapeH, fillColor: l.fillColor, strokeColor: l.strokeColor, strokeWidth: l.strokeWidth });
        else Object.assign(o, { naturalW: l.naturalW, naturalH: l.naturalH, imgSrc: l.img ? l.img.src : null });
        return o;
    })};
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 0)], { type: 'application/octet-stream' }));
    const name = ($('projectName').value.trim() || 'project') + '.vpf';
    a.download = name; a.click();
});
$('btnUndo').addEventListener('click', undo);
$('btnRedo').addEventListener('click', redo);
$('btnHelp').addEventListener('click', () => {
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.innerHTML = `<div class="modal"><div class="modal-header"><h3>基本操作</h3><button class="modal-close">&times;</button></div>
        <p style="font-size:13px;line-height:2"><b>撤销</b> Ctrl+Z &nbsp; <b>重做</b> Ctrl+Y<br>
        <b>删除图层</b> Delete / Backspace<br>
        <b>拖入图片</b> 直接拖文件到画布<br>
        <b>图层操作</b> C复制 V显隐 锁锁定<br>
        <b>画布</b> 上下左右锚点控制扩展方向</p></div>`;
    document.body.appendChild(m);
    m.querySelector('.modal-close').addEventListener('click', () => m.remove());
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
});
$('btnImport').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data.layers || !Array.isArray(data.layers)) throw new Error('格式错误');
            const cw = data.canvas?.width || data.canvasW || 500;
            const ch = data.canvas?.height || data.canvasH || 500;
            setCanvasSize(cw, ch, true);
            $('projectName').value = data.name || 'project';
            canvasManual = true;
            layers = []; nextId = 1;
            const loadImg = (src) => new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const off = document.createElement('canvas');
                    off.width = img.width; off.height = img.height;
                    off.getContext('2d').drawImage(img, 0, 0);
                    const clean = new Image();
                    clean.onload = () => resolve(clean);
                    clean.onerror = () => resolve(null);
                    clean.src = off.toDataURL('image/png');
                };
                img.onerror = () => resolve(null); img.src = src;
            });
            const items = data.layers.map(l => {
                const base = { id: nextId++, type: l.type, label: l.label || '', x: l.x, y: l.y, rotation: l.rotation || 0, scale: l.scale || 100, opacity: l.opacity ?? 100, radius: l.radius || 0, flipH: !!l.flipH, flipV: !!l.flipV, invert: !!l.invert, grayscale: !!l.grayscale, locked: !!l.locked, visible: l.visible !== false };
                if (l.type === 'image') return { base, imgSrc: l.imgSrc, naturalW: l.naturalW, naturalH: l.naturalH };
                return { base, typeProps: l };
            });
            const imgLoads = items.map(it => it.imgSrc ? loadImg(it.imgSrc) : Promise.resolve(null));
            Promise.all(imgLoads).then(imgs => {
                layers = [];
                items.forEach((it, i) => {
                    if (it.typeProps) {
                        const l = it.typeProps;
                        if (l.type === 'text') layers.push(Object.assign(it.base, { text: l.text || '', font: l.font || 'SimHei,STHeiti,sans-serif', fontSize: l.fontSize || 40, color: l.color || '#fff', strokeColor: l.strokeColor || '#000', strokeWidth: l.strokeWidth ?? 3, bold: !!l.bold, italic: !!l.italic }));
                        else if (l.type === 'shape') layers.push(Object.assign(it.base, { shapeType: l.shapeType || 'rect', shapeW: l.shapeW || 100, shapeH: l.shapeH || 80, fillColor: l.fillColor || '#3b82f6', strokeColor: l.strokeColor || '#1d4ed8', strokeWidth: l.strokeWidth ?? 2 }));
                    } else {
                        layers.push(Object.assign(it.base, { img: imgs[i], naturalW: it.naturalW || 100, naturalH: it.naturalH || 100 }));
                    }
                });
                selectLayer(layers.length - 1); updatePanel(); render(); saveHistory();
                $('projectName').value = 'project';
            });
        } catch (err) { alert('导入失败：' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
});

applyZoom(); render(); updatePanel(); saveHistory();

// 离开提示
window.addEventListener('beforeunload', e => {
    if (layers.length > 0) { e.preventDefault(); e.returnValue = ''; }
});
