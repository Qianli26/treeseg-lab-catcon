export const CANVAS_SIZE = 500;

export function clearCanvas(ctx, fill='#0c1713'){
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.fillStyle = fill;
  ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
}

export function drawChm(ctx, image){
  clearCanvas(ctx);
  ctx.drawImage(image,0,0,ctx.canvas.width,ctx.canvas.height);
}

export function drawReferenceCrowns(ctx, refs, {show=true, showEdge=true}={}){
  if(!show || !refs) return;
  ctx.save();
  for(const f of refs.features || []){
    const isEval = !!f.eval_keep;
    if(!isEval && !showEdge) continue;
    ctx.strokeStyle = isEval ? 'rgba(244,248,245,.86)' : 'rgba(176,123,34,.92)';
    ctx.fillStyle = isEval ? 'rgba(84,185,154,.055)' : 'rgba(176,123,34,.08)';
    ctx.lineWidth = isEval ? 1.05 : 1.3;
    ctx.setLineDash(isEval ? [] : [4,3]);
    for(const ring of f.rings || []){
      if(ring.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(ring[0][0], ring[0][1]);
      for(let i=1;i<ring.length;i++) ctx.lineTo(ring[i][0], ring[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawApexes(ctx, apex, {show=true}={}){
  if(!show || !apex) return;
  ctx.save();
  for(const a of apex.features || []){
    const [x,y] = a.point_px;
    ctx.beginPath();
    ctx.arc(x,y,a.eval_keep ? 3.3 : 2.4,0,Math.PI*2);
    ctx.fillStyle = a.eval_keep ? 'rgba(238,255,246,.94)' : 'rgba(255,244,210,.72)';
    ctx.strokeStyle = a.eval_keep ? 'rgba(84,185,154,.96)' : 'rgba(176,123,34,.82)';
    ctx.lineWidth = a.eval_keep ? 1.7 : 1.1;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMethodObjects(ctx, objects, stroke, fill, {lineWidth=1.3, boxes=false}={}){
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  for(const obj of objects || []){
    if(boxes && obj.bbox_px){
      const [x1,y1,x2,y2] = obj.bbox_px;
      ctx.beginPath();
      ctx.rect(x1,y1,x2-x1,y2-y1);
      if(fill) ctx.fill();
      ctx.stroke();
      continue;
    }
    for(const ring of obj.rings || []){
      if(ring.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(ring[0][0], ring[0][1]);
      for(let i=1;i<ring.length;i++) ctx.lineTo(ring[i][0], ring[i][1]);
      ctx.closePath();
      if(fill) ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function metersToPixel(points, p){
  const b = points.bounds_relative;
  return {
    x:(p[0] / b.xmax) * CANVAS_SIZE,
    y:CANVAS_SIZE - (p[1] / b.ymax) * CANVAS_SIZE
  };
}

export function pixelToMeters(points, x, y){
  const b = points.bounds_relative;
  return {
    x:(x / CANVAS_SIZE) * b.xmax,
    y:((CANVAS_SIZE - y) / CANVAS_SIZE) * b.ymax
  };
}

function heightColor(h, alpha=.72){
  if(h < 2) return `rgba(38,55,65,${alpha})`;
  if(h < 8) return `rgba(70,115,92,${alpha})`;
  if(h < 16) return `rgba(69,157,113,${alpha})`;
  return `rgba(235,219,118,${alpha})`;
}

export function drawLasTopView(ctx, points, {show=true, selected=null, radius=3}={}){
  clearCanvas(ctx, '#08120f');
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  for(let i=1;i<5;i++){
    const v = i * CANVAS_SIZE / 5;
    ctx.beginPath();
    ctx.moveTo(v,0); ctx.lineTo(v,CANVAS_SIZE);
    ctx.moveTo(0,v); ctx.lineTo(CANVAS_SIZE,v);
    ctx.stroke();
  }
  if(show && points){
    const pts = points.points || [];
    const step = Math.max(1, Math.ceil(pts.length / 26000));
    for(let i=0;i<pts.length;i+=step){
      const q = metersToPixel(points, pts[i]);
      ctx.fillStyle = heightColor(pts[i][2], .62);
      ctx.fillRect(q.x, q.y, 1.15, 1.15);
    }
  }
  if(selected){
    const r = (radius / 75) * CANVAS_SIZE;
    ctx.strokeStyle = 'rgba(143,227,193,.96)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(selected.x, selected.y, r, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSelection(ctx, selected, radiusMeters=3){
  if(!selected) return;
  const r = (radiusMeters / 75) * CANVAS_SIZE;
  ctx.save();
  ctx.strokeStyle = 'rgba(143,227,193,.96)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(selected.x, selected.y, r, 0, Math.PI*2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(143,227,193,.95)';
  ctx.beginPath();
  ctx.arc(selected.x, selected.y, 3, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

export function localHeights(points, selected, radius=3){
  if(!points || !selected) return [];
  const center = pixelToMeters(points, selected.x, selected.y);
  const r2 = radius * radius;
  const out = [];
  for(const p of points.points || []){
    const dx = p[0] - center.x;
    const dy = p[1] - center.y;
    if(dx*dx + dy*dy <= r2) out.push(p[2]);
  }
  return out;
}

export function drawHistogram(ctx, values){
  clearCanvas(ctx, '#0c1713');
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.strokeRect(.5,.5,ctx.canvas.width-1,ctx.canvas.height-1);
  if(!values.length){
    ctx.fillStyle = '#9fb0a8';
    ctx.font = '12px ui-monospace,monospace';
    ctx.fillText('Click a crown to inspect local LAS heights', 16, ctx.canvas.height/2);
    return;
  }
  const bins = 22;
  const maxH = Math.max(...values, 1);
  const minH = Math.min(...values, 0);
  const counts = Array.from({length:bins},()=>0);
  for(const h of values){
    counts[Math.min(bins-1, Math.floor((h / maxH) * bins))]++;
  }
  const maxC = Math.max(...counts, 1);
  const pad = 18;
  const w = ctx.canvas.width - pad*2;
  const h = ctx.canvas.height - pad*2;
  for(let i=0;i<bins;i++){
    const bh = counts[i] / maxC * h;
    const x = pad + i * (w / bins);
    const y = ctx.canvas.height - pad - bh;
    ctx.fillStyle = i > bins*.65 ? '#eadb76' : '#54b99a';
    ctx.fillRect(x, y, Math.max(1, w/bins - 2), bh);
  }
  ctx.fillStyle = '#9fb0a8';
  ctx.font = '11px ui-monospace,monospace';
  ctx.fillText(`${minH.toFixed(1)} m`, 10, ctx.canvas.height - 6);
  ctx.fillText(`${maxH.toFixed(1)} m`, ctx.canvas.width - 58, ctx.canvas.height - 6);
}

export function nearestApex(apex, selected){
  if(!apex || !selected) return null;
  let best = null;
  let bd = Infinity;
  for(const a of apex.features || []){
    const [x,y] = a.point_px;
    const d = (x-selected.x)**2 + (y-selected.y)**2;
    if(d < bd){ bd = d; best = a; }
  }
  return best ? {...best, distance_px:Math.sqrt(bd)} : null;
}

export function nearestCrown(refs, selected){
  if(!refs || !selected) return null;
  let best = null;
  let bd = Infinity;
  for(const f of refs.features || []){
    const [x,y] = f.centroid_px || [0,0];
    const d = (x-selected.x)**2 + (y-selected.y)**2;
    if(d < bd){ bd = d; best = f; }
  }
  return best ? {...best, distance_px:Math.sqrt(bd)} : null;
}

export function matchPointsToRefs(points, refs, tolPx=16){
  const used = new Array(refs.length).fill(false);
  let tp = 0;
  for(const p of points){
    let best = -1, bd = tolPx * tolPx;
    const px = Array.isArray(p) ? p[0] : p.x;
    const py = Array.isArray(p) ? p[1] : p.y;
    for(let i=0;i<refs.length;i++){
      if(used[i]) continue;
      const c = refs[i].point_px || refs[i].centroid_px;
      const d = (px-c[0])**2 + (py-c[1])**2;
      if(d < bd){ bd = d; best = i; }
    }
    if(best >= 0){ used[best] = true; tp++; }
  }
  const fp = points.length - tp;
  const fn = refs.length - tp;
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  return {tp, fp, fn, precision, recall, f1};
}
