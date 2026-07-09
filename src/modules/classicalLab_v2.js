/**
 * classicalLab_v2.js
 * Changes from original classicalLab.js:
 *   1. All computation functions replaced by imports from compute.js (DRY fix)
 *   2. Minimap canvas added to viewer-head showing where the current patch sits in the full CHM
 */

import {loadJson, loadTeachingAssets} from '../assets.js';
import {
  clamp, extractPatch, smoothPatch, detectLocalMaxima,
  watershedLabels, regionGrowLabels, cellToGlobalPx,
  referenceApexesInPatch, matchApexes,
  drawHeightRaster, drawSegmentation, drawTops,
  drawPatchCrowns, drawPatchApexes, drawCanvasCaption, drawMinimap
} from '../compute.js';

const CASES = [
  {id:'open',  label:'Open crowns',    center:[215,204], note:'Clear peaks and visible valleys.'},
  {id:'dense', label:'Dense canopy',   center:[130,188], note:'Crowded crowns and weak valleys.'},
  {id:'edge',  label:'Edge / partial', center:[479,420], note:'Partial crowns near the patch boundary.'}
];

const PATCH_PX      = 120;
const MATCH_TOL_PX  = 15;

export const classicalLabModule = {
  html(){
    return `
      <section class="module-grid">
        <div class="panel pad span-12">
          <h2>Classical Algorithm Lab</h2>
          <p class="intro">This lab uses a zoomed patch from the real CHM. Students tune local-maximum treetop detection, then watch how watershed or seeded region growing turns those treetops into crown candidates.</p>
        </div>

        <div class="lab-layout span-12">
          <div class="viewer">
            <div class="viewer-head" style="gap:10px">
              <div style="min-width:0">
                <div class="viewer-title" id="classicViewerTitle">Real CHM patch</div>
                <div class="micro-label" id="classicCaseNote">${CASES[0].note}</div>
              </div>
              <!-- Minimap: shows patch location within the full 75 m CHM -->
              <div style="flex:0 0 auto;display:flex;align-items:center;gap:8px">
                <div style="font-size:11px;color:var(--muted);line-height:1.3;text-align:right">
                  patch<br>location
                </div>
                <canvas id="classicMinimap" width="72" height="72"
                        style="border:1px solid var(--line);border-radius:4px;display:block"
                        title="Yellow rectangle shows current patch location in the full 75 m CHM"></canvas>
              </div>
              <span class="concept-chip" style="flex:0 0 auto">live computation</span>
            </div>
            <canvas id="classicCanvas" width="640" height="640"
                    aria-label="Interactive classical ITC detection and delineation canvas"></canvas>
          </div>

          <aside class="toolbar">
            <div class="status" id="classicStatus">Loading CHM and reference data...</div>

            <div class="control-group">
              <div class="control-title">Forest patch</div>
              <div class="segmented" role="group" aria-label="Choose real CHM patch">
                ${CASES.map(c=>`<button data-classic-case="${c.id}" aria-pressed="${c.id==='open'?'true':'false'}">${c.label}</button>`).join('')}
              </div>
            </div>

            <div class="control-group">
              <div class="control-title">Treetop detection</div>
              ${rangeControl('classicSigma',     'Gaussian smoothing (&sigma;)', '0','3','0.1','1.0')}
              ${rangeControl('classicWindow',     'Search window (CHM px)',       '3','37','2','5')}
              ${rangeControl('classicMinHeight',  'Min tree height (m)',          '2','22','0.5','6')}
            </div>

            <div class="control-group">
              <div class="control-title">Crown delineation</div>
              <div class="segmented" role="group" aria-label="Choose segmentation method">
                <button id="classicWatershed" aria-pressed="true">Watershed</button>
                <button id="classicRegion"    aria-pressed="false">Region growing</button>
              </div>
              <label class="check"><input type="checkbox" id="classicShowSeg"  checked>Show algorithm crown boundaries</label>
              <label class="check"><input type="checkbox" id="classicShowRef"  checked>Show reference crowns</label>
              <label class="check"><input type="checkbox" id="classicShowApex" checked>Show reference apexes</label>
            </div>

            <div class="control-group">
              <div class="control-title">Apex matching in this patch</div>
              <div class="metric-grid">
                <div class="metric"><div class="metric-key">Precision</div><div class="metric-val" id="classicPrecision">--</div></div>
                <div class="metric"><div class="metric-key">Recall</div>   <div class="metric-val" id="classicRecall">--</div></div>
                <div class="metric"><div class="metric-key">F1</div>        <div class="metric-val" id="classicF1">--</div></div>
                <div class="metric"><div class="metric-key">Treetops</div> <div class="metric-val" id="classicDetected">--</div></div>
                <div class="metric-band" id="classicActual">Reference apexes: --</div>
              </div>
            </div>
          </aside>
        </div>

        <div class="panel span-12">
          <div class="lesson-list teaching-table">
            <div class="lesson-row"><div class="micro-label">Do</div><div>Drag <span class="term">Smoothing</span>, <span class="term">Search window</span>, and <span class="term">Min height</span>, then switch between <span class="term">Watershed</span> and <span class="term">Region growing</span>.</div></div>
            <div class="lesson-row"><div class="micro-label">See</div><div>The first step is detection: local maxima provide treetop markers. The second step is delineation: pixels are assigned to those markers using a rule.</div></div>
            <div class="lesson-row"><div class="micro-label">Name</div><div>This is <span class="term">scale dependency</span>. A small search window can over-detect bumps inside one crown; a large window can miss suppressed or adjacent trees.</div></div>
            <div class="lesson-row"><div class="micro-label">Connect</div><div>Classical methods are interpretable and useful, but they depend on hand-set assumptions about crown height, spacing, and valleys. The later labs show how ML and DL change those assumptions.</div></div>
          </div>
        </div>
      </section>
    `;
  },

  async init(root){
    const abort  = new AbortController();
    const state  = {
      caseId:'open', sigma:1, windowPx:5, minHeight:6, method:'watershed',
      showSeg:true, showRef:true, showApex:true,
      assets:null, grid:null
    };

    const status = root.querySelector('#classicStatus');
    const setStatus = (kind, text) => {
      status.className   = `status ${kind || ''}`;
      status.textContent = text;
    };

    try{
      const [assets, grid] = await Promise.all([
        loadTeachingAssets(false),
        loadJson('assets/chm_grid.json')
      ]);
      state.assets = assets;
      state.grid   = grid;
      setStatus('ready', 'Loaded real CHM patch. Every treetop, boundary, and metric below is recomputed in the browser.');
      bindControls(root, state, abort.signal, () => render(root, state));
      render(root, state);
    }catch(err){
      setStatus('warn', `Could not load assets: ${err.message}`);
      return () => abort.abort();
    }
    return () => abort.abort();
  }
};

/* ── helpers ──────────────────────────────────────────────── */

function rangeControl(id, label, min, max, step, value){
  return `
    <label class="check" for="${id}" style="justify-content:space-between">
      <span>${label}</span><span class="micro-label" id="${id}Val">${value}</span>
    </label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
  `;
}

function bindControls(root, state, signal, renderFn){
  root.querySelectorAll('[data-classic-case]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-classic-case]').forEach(b => b.setAttribute('aria-pressed','false'));
      btn.setAttribute('aria-pressed','true');
      state.caseId = btn.dataset.classicCase;
      renderFn();
    }, {signal});
  });

  const syncRange = (id, key, fmt = v => String(v)) => {
    const input = root.querySelector(`#${id}`);
    const label = root.querySelector(`#${id}Val`);
    input.addEventListener('input', () => {
      state[key]      = Number(input.value);
      label.textContent = fmt(state[key]);
      renderFn();
    }, {signal});
    label.textContent = fmt(Number(input.value));
  };
  syncRange('classicSigma',    'sigma',    v => v.toFixed(1));
  syncRange('classicWindow',   'windowPx', v => String(Math.round(v)));
  syncRange('classicMinHeight','minHeight',v => v.toFixed(1));

  const setMethod = method => {
    state.method = method;
    root.querySelector('#classicWatershed').setAttribute('aria-pressed', method === 'watershed' ? 'true' : 'false');
    root.querySelector('#classicRegion').setAttribute('aria-pressed',    method === 'region'    ? 'true' : 'false');
    renderFn();
  };
  root.querySelector('#classicWatershed').addEventListener('click', () => setMethod('watershed'), {signal});
  root.querySelector('#classicRegion').addEventListener('click',    () => setMethod('region'),    {signal});

  ['classicShowSeg','classicShowRef','classicShowApex'].forEach(id => {
    const key = {classicShowSeg:'showSeg', classicShowRef:'showRef', classicShowApex:'showApex'}[id];
    root.querySelector(`#${id}`).addEventListener('change', e => { state[key] = e.target.checked; renderFn(); }, {signal});
  });
}

function render(root, state){
  const current  = CASES.find(c => c.id === state.caseId) || CASES[0];
  const patch    = extractPatch(state.grid, current.center, PATCH_PX);
  const smoothed = smoothPatch(patch, state.sigma);
  const tops     = detectLocalMaxima(smoothed, patch.size, state.minHeight, state.windowPx, patch.stride);
  const labels   = state.method === 'watershed'
    ? watershedLabels(smoothed, patch.size, tops, state.minHeight)
    : regionGrowLabels(smoothed, patch.size, tops, state.minHeight);

  /* ── main canvas ─── */
  const canvas = root.querySelector('#classicCanvas');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawHeightRaster(ctx, smoothed, patch.size);
  drawGridHint(ctx, patch.size);
  if(state.showSeg)  drawSegmentation(ctx, labels, patch.size);
  if(state.showRef)  drawPatchCrowns(ctx, state.assets.refs, patch);
  if(state.showApex) drawPatchApexes(ctx, state.assets.apex, patch);
  drawTops(ctx, tops, patch.size);
  drawCanvasCaption(ctx, `${state.method === 'watershed' ? 'watershed' : 'region growing'} | ${tops.length} local maxima | min height ${state.minHeight.toFixed(1)} m`);

  /* ── minimap ─── */
  const mini    = root.querySelector('#classicMinimap');
  const miniCtx = mini.getContext('2d');
  drawMinimap(miniCtx, state.assets.chmImage, patch, 500);

  /* ── metrics ─── */
  const refs       = referenceApexesInPatch(state.assets.apex, patch);
  const detections = tops.map(t => cellToGlobalPx(t, patch));
  const m          = matchApexes(detections, refs, MATCH_TOL_PX);
  root.querySelector('#classicViewerTitle').textContent = `Real CHM patch — ${current.label}`;
  root.querySelector('#classicCaseNote').textContent    = current.note;
  root.querySelector('#classicPrecision').textContent   = fmt(m.precision);
  root.querySelector('#classicRecall').textContent      = fmt(m.recall);
  root.querySelector('#classicF1').textContent          = fmt(m.f1);
  root.querySelector('#classicDetected').textContent    = String(tops.length);
  root.querySelector('#classicActual').textContent      = `Reference apexes: ${refs.length} | matched within ${MATCH_TOL_PX} px`;
}

function fmt(v){ return Number.isFinite(v) ? v.toFixed(2) : '--'; }

function drawGridHint(ctx, size){
  const step = ctx.canvas.width / size;
  if(step < 5) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.035)';
  ctx.lineWidth   = 1;
  for(let i = 0; i <= size; i += 4){
    const v = i * step;
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, ctx.canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(ctx.canvas.width, v); ctx.stroke();
  }
  ctx.restore();
}
