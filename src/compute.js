/**
 * compute.js — shared computation and canvas-drawing utilities
 * extracted from classicalLab.js and studentTasks.js to eliminate duplication.
 *
 * All functions are pure or canvas-only; no DOM queries, no asset loading.
 */

/* ── math helpers ─────────────────────────────────────────── */

export function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

export function percentile(values, p){
  if(!values.length) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const idx = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[idx];
}

function neighbours4(x, y, size){
  const out = [];
  if(x > 0)        out.push([x - 1, y]);
  if(x < size - 1) out.push([x + 1, y]);
  if(y > 0)        out.push([x, y - 1]);
  if(y < size - 1) out.push([x, y + 1]);
  return out;
}

/* ── patch extraction ─────────────────────────────────────── */

/**
 * Extract a square sub-patch from a CHM grid.
 * @param {{values,width,height,stride}} grid
 * @param {[number,number]} centerPx   center in CHM canvas pixels (0-500)
 * @param {number} patchPx             desired patch side in CHM canvas pixels
 * @returns {{stride,size,values,sourcePx:{x,y,size}}}
 */
export function extractPatch(grid, centerPx, patchPx){
  const stride = grid.stride || 2;
  const size   = Math.round(patchPx / stride);
  const half   = Math.floor(size / 2);
  const cx     = Math.round(centerPx[0] / stride);
  const cy     = Math.round(centerPx[1] / stride);
  const x0     = clamp(cx - half, 0, grid.width  - size);
  const y0     = clamp(cy - half, 0, grid.height - size);
  const values = new Float32Array(size * size);
  for(let y = 0; y < size; y++){
    for(let x = 0; x < size; x++){
      values[y * size + x] = grid.values[(y0 + y) * grid.width + (x0 + x)] || 0;
    }
  }
  return {stride, size, values, sourcePx:{x: x0 * stride, y: y0 * stride, size: size * stride}};
}

/* ── Gaussian smoothing ───────────────────────────────────── */

/** Apply separable Gaussian blur to a square patch. */
export function smoothPatch(patch, sigma){
  if(sigma <= 0.05) return Float32Array.from(patch.values);
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = [];
  let sum = 0;
  for(let i = -radius; i <= radius; i++){
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    sum += v;
  }
  for(let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const size = patch.size;
  const tmp  = new Float32Array(size * size);
  const out  = new Float32Array(size * size);
  for(let y = 0; y < size; y++){
    for(let x = 0; x < size; x++){
      let acc = 0;
      for(let k = -radius; k <= radius; k++){
        acc += patch.values[y * size + clamp(x + k, 0, size - 1)] * kernel[k + radius];
      }
      tmp[y * size + x] = acc;
    }
  }
  for(let y = 0; y < size; y++){
    for(let x = 0; x < size; x++){
      let acc = 0;
      for(let k = -radius; k <= radius; k++){
        acc += tmp[clamp(y + k, 0, size - 1) * size + x] * kernel[k + radius];
      }
      out[y * size + x] = acc;
    }
  }
  return out;
}

/* ── local maxima + NMS ───────────────────────────────────── */

/** Safe pixel lookup with boundary clamping. */
export function valueAt(values, size, x, y){
  return values[clamp(y, 0, size - 1) * size + clamp(x, 0, size - 1)] || 0;
}

/**
 * Detect local maxima in a smoothed patch, with non-maximum suppression.
 * Returns array of {x,y,h} in patch grid coordinates.
 */
export function detectLocalMaxima(values, size, minHeight, windowPx, stride){
  const radius  = Math.max(1, Math.round(windowPx / (stride * 2)));
  const nmsDist = Math.max(2, Math.round((windowPx / stride) * 0.55));
  const raw = [];
  for(let y = radius; y < size - radius; y++){
    for(let x = radius; x < size - radius; x++){
      const v = valueAt(values, size, x, y);
      if(v < minHeight) continue;
      let ok = true;
      outer: for(let yy = y - radius; yy <= y + radius; yy++){
        for(let xx = x - radius; xx <= x + radius; xx++){
          if(xx === x && yy === y) continue;
          const nv = valueAt(values, size, xx, yy);
          if(nv > v + 0.04 || (Math.abs(nv - v) <= 0.04 && (yy < y || (yy === y && xx < x)))){
            ok = false; break outer;
          }
        }
      }
      if(ok) raw.push({x, y, h: v});
    }
  }
  raw.sort((a, b) => b.h - a.h);
  const selected = [];
  for(const c of raw){
    if(selected.every(s => (s.x - c.x) ** 2 + (s.y - c.y) ** 2 >= nmsDist * nmsDist))
      selected.push(c);
    if(selected.length >= 90) break;
  }
  return selected;
}

/* ── segmentation ─────────────────────────────────────────── */

/** Marker-based watershed on a square patch. */
export function watershedLabels(values, size, seeds, minHeight){
  const labels    = new Int16Array(size * size);
  const seedIndex = new Map();
  seeds.forEach((seed, i) => {
    const id = seed.y * size + seed.x;
    labels[id] = i + 1;
    seedIndex.set(id, i + 1);
  });
  const order = [];
  for(let id = 0; id < labels.length; id++){
    if(values[id] >= minHeight) order.push(id);
  }
  order.sort((a, b) => values[b] - values[a]);
  for(const id of order){
    if(seedIndex.has(id)) continue;
    const x = id % size, y = Math.floor(id / size);
    const counts = new Map();
    for(const [nx, ny] of neighbours4(x, y, size)){
      const lb = labels[ny * size + nx];
      if(lb > 0) counts.set(lb, (counts.get(lb) || 0) + 1);
    }
    if(counts.size)
      labels[id] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }
  return labels;
}

/** Seeded region-growing on a square patch. */
export function regionGrowLabels(values, size, seeds, minHeight){
  const labels = new Int16Array(size * size);
  const queue  = [];
  seeds.forEach((seed, i) => {
    const id    = seed.y * size + seed.x;
    const label = i + 1;
    labels[id]  = label;
    queue.push({id, label, seedHeight: seed.h});
  });
  let head = 0;
  while(head < queue.length){
    const item      = queue[head++];
    const x         = item.id % size, y = Math.floor(item.id / size);
    const threshold = Math.max(minHeight, item.seedHeight * 0.58);
    for(const [nx, ny] of neighbours4(x, y, size)){
      const nid = ny * size + nx;
      if(labels[nid] > 0 || values[nid] < threshold) continue;
      labels[nid] = item.label;
      queue.push({id: nid, label: item.label, seedHeight: item.seedHeight});
    }
  }
  return labels;
}

/* ── coordinate conversion ────────────────────────────────── */

/** Convert a local-maxima grid cell to CHM canvas-pixel coordinates. */
export function cellToGlobalPx(top, patch){
  return {
    x: patch.sourcePx.x + (top.x + 0.5) * patch.stride,
    y: patch.sourcePx.y + (top.y + 0.5) * patch.stride,
    h: top.h
  };
}

/** Return all eval apex references that fall inside a patch (CHM canvas-pixel coords). */
export function referenceApexesInPatch(apex, patch){
  const x1 = patch.sourcePx.x, y1 = patch.sourcePx.y;
  const x2 = x1 + patch.sourcePx.size, y2 = y1 + patch.sourcePx.size;
  return (apex.features || [])
    .filter(a => a.eval_keep)
    .map(a => ({x: a.point_px[0], y: a.point_px[1], id: a.id}))
    .filter(a => a.x >= x1 && a.x <= x2 && a.y >= y1 && a.y <= y2);
}

/* ── apex matching ────────────────────────────────────────── */

/**
 * Match predicted points against reference points with a distance tolerance.
 * Returns {tp, fp, fn, precision, recall, f1, pointStatus}.
 * pointStatus[i] is 'matched' or 'extra' for each prediction point.
 */
export function matchApexes(detections, refs, tolPx){
  const used        = new Array(refs.length).fill(false);
  const pointStatus = new Array(detections.length).fill('extra');
  let tp = 0;
  for(let di = 0; di < detections.length; di++){
    const d    = detections[di];
    const dx   = Array.isArray(d) ? d[0] : (d.x ?? d[0]);
    const dy   = Array.isArray(d) ? d[1] : (d.y ?? d[1]);
    let best   = -1, bd = tolPx * tolPx;
    for(let ri = 0; ri < refs.length; ri++){
      if(used[ri]) continue;
      const c  = refs[ri].point_px || refs[ri];
      const cx = Array.isArray(c) ? c[0] : (c.x ?? c[0]);
      const cy = Array.isArray(c) ? c[1] : (c.y ?? c[1]);
      const d2 = (dx - cx) ** 2 + (dy - cy) ** 2;
      if(d2 < bd){ bd = d2; best = ri; }
    }
    if(best >= 0){ used[best] = true; pointStatus[di] = 'matched'; tp++; }
  }
  const fp        = detections.length - tp;
  const fn        = refs.length - tp;
  const precision = tp / (tp + fp || 1);
  const recall    = tp / (tp + fn || 1);
  const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  return {tp, fp, fn, precision, recall, f1, pointStatus};
}

/* ── canvas drawing ───────────────────────────────────────── */

const HEIGHT_RAMP_STOPS = [
  [6,21,18],[17,68,51],[46,119,75],[127,171,83],[229,222,106],[255,248,179]
];

function palette(t, stops){
  const s = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(',')})`;
}

export function heightRamp(t){
  return palette(clamp(t, 0, 1), HEIGHT_RAMP_STOPS);
}

/** Render a 2D height raster for a square patch values array. */
export function drawHeightRaster(ctx, values, size){
  const cW = ctx.canvas.width / size, cH = ctx.canvas.height / size;
  const hi = percentile(values, 0.985), lo = percentile(values, 0.02);
  for(let y = 0; y < size; y++){
    for(let x = 0; x < size; x++){
      const v = values[y * size + x];
      const t = Math.pow(clamp((v - lo) / ((hi - lo) || 1), 0, 1), 0.82);
      ctx.fillStyle = heightRamp(t);
      ctx.fillRect(x * cW, y * cH, Math.ceil(cW), Math.ceil(cH));
    }
  }
}

/** Render per-region HSL fill + watershed/region-grow boundary strokes. */
export function drawSegmentation(ctx, labels, size){
  const cW = ctx.canvas.width / size, cH = ctx.canvas.height / size;
  ctx.save();
  for(let y = 1; y < size - 1; y++){
    for(let x = 1; x < size - 1; x++){
      const id = y * size + x, label = labels[id];
      if(label <= 0) continue;
      ctx.fillStyle = `hsla(${(label * 47) % 360},58%,58%,.05)`;
      ctx.fillRect(x * cW, y * cH, Math.ceil(cW), Math.ceil(cH));
    }
  }
  strokeBorders(ctx, labels, size, cW, cH, 'rgba(6,18,16,.58)', 5);
  strokeBorders(ctx, labels, size, cW, cH, 'rgba(31,123,205,.98)', 2.5);
  ctx.restore();
}

function strokeBorders(ctx, labels, size, cW, cH, color, width){
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for(let y = 1; y < size - 1; y++){
    for(let x = 1; x < size - 1; x++){
      const id = y * size + x, label = labels[id];
      if(label <= 0) continue;
      const x0 = x * cW, y0 = y * cH;
      if(labels[id + 1]    !== label){ ctx.moveTo(x0 + cW, y0); ctx.lineTo(x0 + cW, y0 + cH); }
      if(labels[id + size] !== label){ ctx.moveTo(x0, y0 + cH); ctx.lineTo(x0 + cW, y0 + cH); }
    }
  }
  ctx.stroke();
}

/**
 * Render reference crowns clipped to a patch.
 * Eval crowns are shown with solid white; partial/edge with dashed amber.
 */
export function drawPatchCrowns(ctx, refs, patch){
  const sx = ctx.canvas.width / patch.sourcePx.size;
  const sy = ctx.canvas.height / patch.sourcePx.size;
  ctx.save();
  for(const f of refs.features || []){
    const isEval = !!f.eval_keep;
    ctx.strokeStyle = isEval ? 'rgba(248,252,249,.86)' : 'rgba(227,172,82,.88)';
    ctx.lineWidth   = isEval ? 1.25 : 1.5;
    ctx.setLineDash(isEval ? [] : [6, 4]);
    for(const ring of f.rings || []){
      if(ring.length < 2) continue;
      const local = ring.map(([x, y]) => [(x - patch.sourcePx.x) * sx, (y - patch.sourcePx.y) * sy]);
      if(!local.some(([x, y]) => x >= -12 && y >= -12 && x <= ctx.canvas.width + 12 && y <= ctx.canvas.height + 12)) continue;
      ctx.beginPath();
      ctx.moveTo(local[0][0], local[0][1]);
      for(let i = 1; i < local.length; i++) ctx.lineTo(local[i][0], local[i][1]);
      ctx.closePath(); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Render apex points clipped to a patch.
 * @param {boolean} evalOnly  if true, skip non-eval apexes
 */
export function drawPatchApexes(ctx, apex, patch, {evalOnly=false}={}){
  const sx = ctx.canvas.width / patch.sourcePx.size;
  const sy = ctx.canvas.height / patch.sourcePx.size;
  ctx.save();
  for(const a of apex.features || []){
    if(evalOnly && !a.eval_keep) continue;
    const [px, py] = a.point_px || [];
    if(px == null || py == null) continue;
    if(px < patch.sourcePx.x || py < patch.sourcePx.y ||
       px > patch.sourcePx.x + patch.sourcePx.size ||
       py > patch.sourcePx.y + patch.sourcePx.size) continue;
    const x = (px - patch.sourcePx.x) * sx;
    const y = (py - patch.sourcePx.y) * sy;
    ctx.fillStyle   = a.eval_keep ? 'rgba(238,255,246,.96)' : 'rgba(255,222,142,.82)';
    ctx.strokeStyle = a.eval_keep ? 'rgba(45,138,105,.98)'  : 'rgba(160,100,30,.95)';
    ctx.lineWidth   = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, a.eval_keep ? 4.3 : 3.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Render detected treetops (yellow dots + outer ring) on a patch canvas.
 */
export function drawTops(ctx, tops, size){
  const sx = ctx.canvas.width / size, sy = ctx.canvas.height / size;
  ctx.save();
  for(const top of tops){
    const x = (top.x + 0.5) * sx, y = (top.y + 0.5) * sy;
    ctx.strokeStyle = 'rgba(10,18,14,.92)';
    ctx.fillStyle   = 'rgba(255,241,121,.98)';
    ctx.lineWidth   = 2.1;
    ctx.beginPath(); ctx.arc(x, y, 5.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,241,121,.75)';
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** Small bottom-bar caption on a canvas (dark band + monospace label). */
export function drawCanvasCaption(ctx, text){
  ctx.save();
  ctx.fillStyle = 'rgba(7,18,14,.76)';
  ctx.fillRect(0, ctx.canvas.height - 34, ctx.canvas.width, 34);
  ctx.fillStyle = '#d8e4dd';
  ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillText(text, 14, ctx.canvas.height - 13);
  ctx.restore();
}

/**
 * Draw minimap: thumbnail of the full CHM image with a highlighted patch rectangle.
 * @param {CanvasRenderingContext2D} ctx   minimap context
 * @param {HTMLImageElement}  chmImage
 * @param {{sourcePx:{x,y,size}}} patch   result of extractPatch()
 * @param {number} chmNativePx            native CHM width/height in canvas-pixels (500)
 */
export function drawMinimap(ctx, chmImage, patch, chmNativePx = 500){
  const mw = ctx.canvas.width, mh = ctx.canvas.height;
  ctx.drawImage(chmImage, 0, 0, mw, mh);
  const scale = mw / chmNativePx;
  const rx = patch.sourcePx.x * scale, ry = patch.sourcePx.y * scale;
  const rw = patch.sourcePx.size * scale, rh = patch.sourcePx.size * scale;
  ctx.strokeStyle = '#f0da70';
  ctx.lineWidth   = 2;
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.fillStyle   = 'rgba(240,218,112,.18)';
  ctx.fillRect(rx, ry, rw, rh);
}
