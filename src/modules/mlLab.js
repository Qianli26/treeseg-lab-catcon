import {loadJson, loadTeachingAssets} from '../assets.js';

const CASES = [
  {
    id:'isolated',
    label:'Isolated crown',
    center:[215,204],
    note:'A crown with a clear peak and relatively open neighbourhood.'
  },
  {
    id:'dense',
    label:'Dense canopy',
    center:[130,188],
    note:'A crowded patch where nearby crowns make separation cues ambiguous.'
  },
  {
    id:'edge',
    label:'Edge crown',
    center:[479,420],
    note:'A partial / edge crown, useful for discussing excluded or uncertain references.'
  }
];

export const mlLabModule = {
  html(){
    return `
      <section class="module-grid">
        <div class="panel pad span-12">
          <h2>Feature Learning Bridge</h2>
          <p class="intro">Deep learning does not remove features. It changes who designs them: from researcher-defined feature tables to model-learned feature representations. This bridge shows the kinds of crown cues a traditional ML workflow might compute explicitly, and how similar cues can become learned feature maps in a CNN or segmentation model.</p>
        </div>

        <div class="panel pad span-12">
          <div class="feature-lab-head">
            <div>
              <h3>Choose a real CHM patch</h3>
              <p class="card-body" id="featureCaseNote">${CASES[0].note}</p>
            </div>
            <div class="segmented" role="group" aria-label="Choose feature bridge case">
              ${CASES.map((c,i)=>`<button data-feature-case="${c.id}" aria-pressed="${i===0?'true':'false'}">${c.label}</button>`).join('')}
            </div>
          </div>
          <div class="status" id="featureStatus" style="margin-top:14px">Loading CHM feature assets...</div>
        </div>

        <div class="feature-process-grid span-12">
          ${processCard('Original CHM patch','Raw canopy-height evidence for one local neighbourhood.','featureOriginal')}
          ${processCard('Local maxima candidates','A classical treetop cue after non-maximum suppression: one peak per local crown candidate.','featureMaxima')}
          ${processCard('Candidate crown objects','Each treetop seed becomes a candidate object; the highlighted object feeds the feature table.','featureObject')}
          ${processCard('Gradient / edge cue','Height contrast that may correspond to crown boundaries.','featureGradient')}
          ${processCard('Roughness / texture cue','Within-crown surface variation and multi-peak structure.','featureRoughness')}
          ${processCard('Valley / separation cue','Low or contrasting canopy between neighbouring crowns.','featureValley')}
        </div>

        <div class="module-grid span-12">
          <div class="panel pad span-7">
            <h3>Candidate crown feature vector</h3>
            <p class="card-body">Traditional ML needs this step explicitly: a crown candidate becomes a row of numbers before a classifier can use it.</p>
            <table class="info-table" id="featureVectorTable"></table>
          </div>
          <div class="panel pad span-5">
            <h3>Toy classifier view</h3>
            <p class="card-body">This is a teaching classifier, not a trained model. It shows how hand-crafted features might be weighted when judging whether a candidate is a valid crown.</p>
            <canvas id="featureClassifier" class="profile-canvas" width="420" height="260"></canvas>
          </div>
        </div>

        <div class="panel pad span-12">
          <h3>Hand-crafted features and possible learned analogues</h3>
          <table class="info-table">
            <thead><tr><th>Hand-crafted feature</th><th>What it encodes</th><th>Possible learned feature analogue</th></tr></thead>
            <tbody>
              <tr><th>Local maximum response</th><td>A likely treetop or apex.</td><td>High activation for apex-like local height patterns.</td></tr>
              <tr><th>CHM gradient</th><td>Height contrast around a crown.</td><td>Learned edge / boundary filters in early feature maps.</td></tr>
              <tr><th>Valley depth</th><td>Evidence separating neighbouring crowns.</td><td>Learned separation cue between adjacent instances.</td></tr>
              <tr><th>Compactness / area</th><td>Whether a candidate object has plausible crown shape and size.</td><td>Learned shape representation in middle or deep layers.</td></tr>
              <tr><th>Roughness / texture</th><td>Multi-peak or uneven crown surface.</td><td>Learned crown texture and within-object variation.</td></tr>
              <tr><th>Neighbour distance</th><td>Crowding and likely ambiguity.</td><td>Learned spatial context for dense canopy and overlapping crowns.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel pad span-12">
          <h3>Bridge sentence for students</h3>
          <div class="callout">Deep learning still learns features. The difference is that classical ML asks the researcher to design and calculate the feature table first, while deep learning learns multi-level feature maps from CHM images, reference boxes, masks, and training loss.</div>
        </div>
      </section>
    `;
  },
  async init(root){
    const abort = new AbortController();
    const status = root.querySelector('#featureStatus');
    let state = {caseId:'isolated', assets:null, grid:null};

    const setStatus = (kind, text)=>{
      status.className = `status ${kind || ''}`;
      status.textContent = text;
    };

    const render = ()=>{
      if(!state.assets || !state.grid) return;
      const current = CASES.find(c=>c.id===state.caseId) || CASES[0];
      root.querySelector('#featureCaseNote').textContent = current.note;
      const patch = extractPatch(state.grid, current.center, 144);
      const seeds = localMaxima(patch);
      const candidates = candidateMasks(patch, seeds);
      const focusCandidate = chooseFocusCandidate(candidates, patch);
      drawOriginal(root.querySelector('#featureOriginal'), state.assets.chmImage, state.assets.refs, state.assets.apex, patch);
      drawMaxima(root.querySelector('#featureMaxima'), patch, seeds);
      drawCandidateObjects(root.querySelector('#featureObject'), patch, candidates, focusCandidate);
      drawFeatureMap(root.querySelector('#featureGradient'), patch, gradientMap(patch), 'gradient');
      drawFeatureMap(root.querySelector('#featureRoughness'), patch, roughnessMap(patch), 'roughness');
      drawFeatureMap(root.querySelector('#featureValley'), patch, valleyMap(patch), 'valley');
      const features = computeFeatures(patch, focusCandidate, state.assets.apex, current.center);
      renderFeatureTable(root.querySelector('#featureVectorTable'), features);
      drawClassifier(root.querySelector('#featureClassifier'), features);
    };

    try{
      const [assets, grid] = await Promise.all([
        loadTeachingAssets(false),
        loadJson('assets/chm_grid.json')
      ]);
      state.assets = assets;
      state.grid = grid;
      setStatus('ready', 'Loaded real CHM grid and reference assets. Feature maps are generated in the browser from the selected patch.');
      render();
    }catch(err){
      setStatus('warn', err.message);
      return () => abort.abort();
    }

    root.querySelectorAll('[data-feature-case]').forEach(button=>{
      button.addEventListener('click', ()=>{
        root.querySelectorAll('[data-feature-case]').forEach(b=>b.setAttribute('aria-pressed','false'));
        button.setAttribute('aria-pressed','true');
        state.caseId = button.dataset.featureCase;
        render();
      }, {signal:abort.signal});
    });

    return () => abort.abort();
  }
};

function processCard(title, subtitle, id){
  return `
    <article class="panel process-card">
      <div>
        <h3>${title}</h3>
        <p>${subtitle}</p>
      </div>
      <canvas id="${id}" width="260" height="220" aria-label="${title}"></canvas>
    </article>
  `;
}

function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

function stats(values){
  const n = values.length || 1;
  const mean = values.reduce((a,b)=>a+b,0) / n;
  const variance = values.reduce((a,b)=>a+(b-mean)*(b-mean),0) / n;
  return {mean, std:Math.sqrt(variance), min:Math.min(...values), max:Math.max(...values)};
}

function extractPatch(grid, centerPx, patchPx){
  const stride = grid.stride || 2;
  const halfCells = Math.round((patchPx / stride) / 2);
  const cx = Math.round(centerPx[0] / stride);
  const cy = Math.round(centerPx[1] / stride);
  const x0 = clamp(cx - halfCells, 0, grid.width - halfCells * 2 - 1);
  const y0 = clamp(cy - halfCells, 0, grid.height - halfCells * 2 - 1);
  const size = halfCells * 2;
  const values = [];
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      values.push(grid.values[(y0+y)*grid.width + (x0+x)]);
    }
  }
  return {
    stride,
    size,
    values,
    x0,
    y0,
    sourcePx:{x:x0*stride, y:y0*stride, size:size*stride},
    centerPx:{x:centerPx[0], y:centerPx[1]}
  };
}

function patchValue(patch, x, y){
  x = clamp(x,0,patch.size-1);
  y = clamp(y,0,patch.size-1);
  return patch.values[y*patch.size+x] || 0;
}

function drawPatchRaster(ctx, patch, mapper){
  const cellW = ctx.canvas.width / patch.size;
  const cellH = ctx.canvas.height / patch.size;
  for(let y=0;y<patch.size;y++){
    for(let x=0;x<patch.size;x++){
      ctx.fillStyle = mapper(patchValue(patch,x,y), x, y);
      ctx.fillRect(x*cellW, y*cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }
}

function ramp(t){
  t = clamp(t,0,1);
  const stops = [[10,24,20],[28,92,62],[78,146,76],[183,201,82],[241,226,135]];
  const s = t*(stops.length-1);
  const i = Math.floor(s);
  const f = s-i;
  const a = stops[i], b = stops[Math.min(stops.length-1,i+1)];
  const c = a.map((v,j)=>Math.round(v+(b[j]-v)*f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function heat(t, mode){
  t = clamp(t,0,1);
  if(mode === 'gradient') return palette(t, [[4,20,28],[22,88,96],[86,184,157],[236,225,128],[255,251,210]]);
  if(mode === 'roughness') return palette(t, [[12,22,52],[46,55,132],[118,75,164],[214,126,184],[255,224,238]]);
  return palette(t, [[7,25,42],[30,80,93],[91,139,92],[218,195,66],[255,244,150]]);
}

function palette(t, stops){
  const s = t * (stops.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  const c = a.map((v,j)=>Math.round(v + (b[j]-v)*f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function drawOriginal(canvas, image, refs, apex, patch){
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image, patch.sourcePx.x, patch.sourcePx.y, patch.sourcePx.size, patch.sourcePx.size, 0, 0, canvas.width, canvas.height);
  drawPatchCrowns(ctx, refs, patch);
  drawPatchApex(ctx, apex, patch);
  label(ctx, 'real CHM patch + reference cues');
}

function drawPatchCrowns(ctx, refs, patch){
  const sx = canvasScaleX(ctx, patch), sy = canvasScaleY(ctx, patch);
  ctx.save();
  ctx.strokeStyle = 'rgba(245,250,246,.84)';
  ctx.lineWidth = 1;
  for(const f of refs.features || []){
    for(const ring of f.rings || []){
      const local = ring.map(([x,y])=>[(x-patch.sourcePx.x)*sx,(y-patch.sourcePx.y)*sy]);
      if(!local.some(([x,y])=>x>=-10&&y>=-10&&x<=ctx.canvas.width+10&&y<=ctx.canvas.height+10)) continue;
      ctx.beginPath();
      ctx.moveTo(local[0][0], local[0][1]);
      for(let i=1;i<local.length;i++) ctx.lineTo(local[i][0], local[i][1]);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPatchApex(ctx, apex, patch){
  const sx = canvasScaleX(ctx, patch), sy = canvasScaleY(ctx, patch);
  ctx.save();
  ctx.fillStyle = 'rgba(143,227,193,.95)';
  ctx.strokeStyle = 'rgba(7,18,14,.78)';
  for(const a of apex.features || []){
    const [px,py] = a.point_px;
    const x = (px-patch.sourcePx.x)*sx;
    const y = (py-patch.sourcePx.y)*sy;
    if(x<0||y<0||x>ctx.canvas.width||y>ctx.canvas.height) continue;
    ctx.beginPath();
    ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function canvasScaleX(ctx, patch){ return ctx.canvas.width / patch.sourcePx.size; }
function canvasScaleY(ctx, patch){ return ctx.canvas.height / patch.sourcePx.size; }

function localMaxima(patch){
  const raw = [];
  const r = 4;
  for(let y=r;y<patch.size-r;y++){
    for(let x=r;x<patch.size-r;x++){
      const v = patchValue(patch,x,y);
      if(v < 7) continue;
      let ok = true;
      for(let yy=y-r;yy<=y+r && ok;yy++){
        for(let xx=x-r;xx<=x+r;xx++){
          if(xx===x && yy===y) continue;
          if(patchValue(patch,xx,yy) > v + 0.05){ ok = false; break; }
        }
      }
      if(ok) raw.push({x,y,h:v});
    }
  }
  raw.sort((a,b)=>b.h-a.h);
  const selected = [];
  const minDist = 8;
  for(const candidate of raw){
    const farEnough = selected.every(s => (s.x-candidate.x)**2 + (s.y-candidate.y)**2 >= minDist*minDist);
    if(farEnough) selected.push(candidate);
    if(selected.length >= 18) break;
  }
  return selected;
}

function drawMaxima(canvas, patch, seeds=localMaxima(patch)){
  const ctx = canvas.getContext('2d');
  const patchStats = stats(patch.values);
  drawPatchRaster(ctx, patch, v=>ramp(v/(patchStats.max||1)));
  const scaleX = canvas.width / patch.size;
  const scaleY = canvas.height / patch.size;
  ctx.save();
  ctx.fillStyle = 'rgba(255,245,172,.96)';
  ctx.strokeStyle = 'rgba(7,18,14,.80)';
  for(const m of seeds){
    ctx.beginPath();
    ctx.arc((m.x+.5)*scaleX,(m.y+.5)*scaleY,4.2,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  label(ctx, `${seeds.length} peaks after non-maximum suppression`);
}

function candidateMasks(patch, seeds){
  const assigned = new Int16Array(patch.size * patch.size).fill(-1);
  const candidates = [];
  seeds.forEach((seed, index)=>{
    const candidate = growCandidate(patch, seed, assigned, index);
    const areaCells = candidate.mask.reduce((a,b)=>a+b,0);
    if(areaCells >= 14) candidates.push(candidate);
  });
  return candidates;
}

function growCandidate(patch, seed, assigned, index){
  const threshold = Math.max(5, seed.h * .62);
  const maxGrowRadius = 15;
  const mask = new Uint8Array(patch.size * patch.size);
  const q = [seed.y*patch.size+seed.x];
  mask[q[0]] = 1;
  assigned[q[0]] = index;
  let head = 0;
  while(head < q.length){
    const id = q[head++];
    const x = id % patch.size;
    const y = Math.floor(id / patch.size);
    for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
      if(nx<0||ny<0||nx>=patch.size||ny>=patch.size) continue;
      const nid = ny*patch.size+nx;
      if(mask[nid]) continue;
      if(assigned[nid] >= 0) continue;
      const d2 = (nx-seed.x)*(nx-seed.x) + (ny-seed.y)*(ny-seed.y);
      if(d2 <= maxGrowRadius*maxGrowRadius && patchValue(patch,nx,ny) >= threshold){
        mask[nid] = 1;
        assigned[nid] = index;
        q.push(nid);
      }
    }
  }
  return {mask, seed, threshold, index};
}

function chooseFocusCandidate(candidates, patch){
  if(!candidates.length){
    const seed = {x:Math.floor(patch.size/2), y:Math.floor(patch.size/2), h:patchValue(patch, Math.floor(patch.size/2), Math.floor(patch.size/2))};
    return {mask:new Uint8Array(patch.size*patch.size), seed, threshold:0, index:-1};
  }
  const c = patch.size / 2;
  return candidates
    .slice()
    .sort((a,b)=>((a.seed.x-c)**2+(a.seed.y-c)**2)-((b.seed.x-c)**2+(b.seed.y-c)**2))[0];
}

function drawCandidateObjects(canvas, patch, candidates, focusCandidate){
  const ctx = canvas.getContext('2d');
  const patchStats = stats(patch.values);
  drawPatchRaster(ctx, patch, v=>ramp(v/(patchStats.max||1)));
  const cellW = canvas.width / patch.size;
  const cellH = canvas.height / patch.size;
  const fills = [
    'rgba(84,185,154,.36)',
    'rgba(230,215,121,.34)',
    'rgba(83,154,176,.34)',
    'rgba(159,196,107,.34)',
    'rgba(191,115,84,.30)'
  ];
  ctx.save();
  candidates.forEach((candidate, i)=>{
    const isFocus = candidate === focusCandidate;
    ctx.fillStyle = isFocus ? 'rgba(84,185,154,.58)' : fills[i % fills.length];
    for(let y=0;y<patch.size;y++){
      for(let x=0;x<patch.size;x++){
        if(candidate.mask[y*patch.size+x]) ctx.fillRect(x*cellW,y*cellH,Math.ceil(cellW),Math.ceil(cellH));
      }
    }
  });
  for(const candidate of candidates){
    const isFocus = candidate === focusCandidate;
    ctx.strokeStyle = isFocus ? 'rgba(255,255,255,.96)' : 'rgba(230,240,234,.58)';
    ctx.lineWidth = isFocus ? 1.5 : .85;
    for(let y=1;y<patch.size-1;y++){
      for(let x=1;x<patch.size-1;x++){
        const id = y*patch.size+x;
        if(!candidate.mask[id]) continue;
        if(!candidate.mask[id-1] || !candidate.mask[id+1] || !candidate.mask[id-patch.size] || !candidate.mask[id+patch.size]){
          ctx.strokeRect(x*cellW,y*cellH,cellW,cellH);
        }
      }
    }
    ctx.fillStyle = isFocus ? '#f4df70' : 'rgba(255,245,172,.86)';
    ctx.beginPath();
    ctx.arc((candidate.seed.x+.5)*cellW,(candidate.seed.y+.5)*cellH,isFocus?4.3:3.2,0,Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
  label(ctx, `${candidates.length} objects; bright one -> feature table`);
}

function gradientMap(patch){
  const values = [];
  for(let y=0;y<patch.size;y++){
    for(let x=0;x<patch.size;x++){
      const dx = patchValue(patch,x+1,y) - patchValue(patch,x-1,y);
      const dy = patchValue(patch,x,y+1) - patchValue(patch,x,y-1);
      values.push(Math.sqrt(dx*dx+dy*dy));
    }
  }
  return values;
}

function roughnessMap(patch){
  const values = [];
  for(let y=0;y<patch.size;y++){
    for(let x=0;x<patch.size;x++){
      const around = [];
      for(let yy=y-1;yy<=y+1;yy++) for(let xx=x-1;xx<=x+1;xx++) around.push(patchValue(patch,xx,yy));
      values.push(stats(around).std);
    }
  }
  return values;
}

function valleyMap(patch){
  const g = gradientMap(patch);
  const s = stats(patch.values);
  const gs = stats(g);
  return patch.values.map((v,i)=>{
    const low = 1 - v/(s.max || 1);
    const edge = g[i] / (gs.max || 1);
    return .58 * low + .42 * edge;
  });
}

function drawFeatureMap(canvas, patch, map, mode){
  const ctx = canvas.getContext('2d');
  const lo = percentile(map, mode === 'valley' ? 0.08 : 0.05);
  const hi = percentile(map, mode === 'valley' ? 0.90 : 0.94);
  const cellW = canvas.width / patch.size;
  const cellH = canvas.height / patch.size;
  for(let y=0;y<patch.size;y++){
    for(let x=0;x<patch.size;x++){
      const v = map[y*patch.size+x];
      const stretched = Math.pow(clamp((v-lo)/((hi-lo)||1),0,1), .58);
      ctx.fillStyle = heat(stretched, mode);
      ctx.fillRect(x*cellW,y*cellH,Math.ceil(cellW),Math.ceil(cellH));
    }
  }
  const labels = {
    gradient:'edge / boundary feature map',
    roughness:'roughness / texture feature map',
    valley:'valley / separation feature map'
  };
  label(ctx, labels[mode] || 'feature map');
}

function percentile(values, p){
  if(!values.length) return 0;
  const sorted = Array.from(values).sort((a,b)=>a-b);
  const idx = clamp(Math.floor((sorted.length-1)*p), 0, sorted.length-1);
  return sorted[idx];
}

function computeFeatures(patch, candidate, apex, center){
  const selected = [];
  const boundaryRing = [];
  let minX = patch.size, minY = patch.size, maxX = 0, maxY = 0;
  for(let y=0;y<patch.size;y++){
    for(let x=0;x<patch.size;x++){
      const id = y*patch.size+x;
      if(candidate.mask[id]){
        selected.push(patchValue(patch,x,y));
        minX = Math.min(minX,x); minY = Math.min(minY,y);
        maxX = Math.max(maxX,x); maxY = Math.max(maxY,y);
        for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
          if(nx<0||ny<0||nx>=patch.size||ny>=patch.size) continue;
          if(!candidate.mask[ny*patch.size+nx]) boundaryRing.push(patchValue(patch,nx,ny));
        }
      }
    }
  }
  const st = stats(selected.length ? selected : patch.values);
  const ring = stats(boundaryRing.length ? boundaryRing : patch.values);
  const cellM = patch.stride * 0.15;
  const area = selected.length * cellM * cellM;
  const widthM = Math.max(1,(maxX-minX+1) * cellM);
  const heightM = Math.max(1,(maxY-minY+1) * cellM);
  const radius = Math.max(widthM,heightM) / 2;
  const compactness = clamp(area / (Math.PI * radius * radius), 0, 1.2);
  const apexDistances = (apex.features || [])
    .filter(a=>a.eval_keep)
    .map(a=>Math.hypot(a.point_px[0]-center[0], a.point_px[1]-center[1]))
    .filter(d=>d>2)
    .sort((a,b)=>a-b);
  const neighbourPx = apexDistances[0] || 99;
  const neighbourM = neighbourPx * 0.15;
  const valleyDepth = st.max - ring.mean;
  const roughness = st.std;
  const score = toyScore({
    peakHeight:st.max,
    compactness,
    valleyDepth,
    neighbourM,
    roughness
  });
  return {
    peakHeight:st.max,
    meanHeight:st.mean,
    heightStd:st.std,
    area,
    compactness,
    valleyDepth,
    neighbourM,
    roughness,
    score
  };
}

function toyScore(f){
  const peak = clamp((f.peakHeight - 7) / 18, 0, 1);
  const compact = clamp(f.compactness, 0, 1);
  const valley = clamp(f.valleyDepth / 14, 0, 1);
  const space = clamp(f.neighbourM / 5, 0, 1);
  const rough = clamp(f.roughness / 6, 0, 1);
  const z = -1.05 + 1.25*peak + .75*compact + .95*valley + .55*space - .55*rough;
  return 1 / (1 + Math.exp(-z));
}

function renderFeatureTable(table, f){
  const rows = [
    ['peak_height', `${f.peakHeight.toFixed(1)} m`, 'Highest canopy point in the candidate.'],
    ['mean_height', `${f.meanHeight.toFixed(1)} m`, 'Average height inside the seed-grown candidate.'],
    ['height_std / roughness', `${f.heightStd.toFixed(1)} m`, 'Surface variation, often larger in multi-peak crowns.'],
    ['candidate_area', `${f.area.toFixed(1)} m2`, 'Object size from the candidate mask.'],
    ['compactness', f.compactness.toFixed(2), 'How close the candidate is to a compact crown-like object.'],
    ['valley_depth', `${f.valleyDepth.toFixed(1)} m`, 'Height drop from peak/object to neighbouring canopy.'],
    ['nearest_neighbour', `${f.neighbourM.toFixed(1)} m`, 'Crowding cue from nearby apex references.']
  ];
  table.innerHTML = `
    <thead><tr><th>Feature</th><th>Value</th><th>Meaning</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>
  `;
}

function drawClassifier(canvas, f){
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#08120f';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#e9f5ef';
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(`Toy valid-crown score: ${f.score.toFixed(2)}`, 18, 30);
  const items = [
    ['peak height', clamp((f.peakHeight - 7) / 18, 0, 1), '#e6d779'],
    ['compactness', clamp(f.compactness, 0, 1), '#54b99a'],
    ['valley depth', clamp(f.valleyDepth / 14, 0, 1), '#63a9b7'],
    ['neighbour space', clamp(f.neighbourM / 5, 0, 1), '#9ec46b'],
    ['roughness penalty', clamp(f.roughness / 6, 0, 1), '#bf7354']
  ];
  ctx.font = '12px ui-monospace,monospace';
  items.forEach((item,i)=>{
    const y = 62 + i*34;
    ctx.fillStyle = '#9fb0a8';
    ctx.fillText(item[0], 18, y+13);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(160, y, 220, 16);
    ctx.fillStyle = item[2];
    ctx.fillRect(160, y, 220*item[1], 16);
    ctx.fillStyle = '#d8e4dd';
    ctx.fillText(item[1].toFixed(2), 388, y+13);
  });
  ctx.fillStyle = '#9fb0a8';
  ctx.fillText('Teaching view: weighted hand-crafted feature cues', 18, canvas.height - 16);
}

function label(ctx, text){
  ctx.fillStyle = 'rgba(7,18,14,.74)';
  ctx.fillRect(0, ctx.canvas.height-26, ctx.canvas.width, 26);
  ctx.fillStyle = '#cbd9d1';
  ctx.font = '11px ui-monospace,monospace';
  ctx.fillText(text, 10, ctx.canvas.height - 9);
}
