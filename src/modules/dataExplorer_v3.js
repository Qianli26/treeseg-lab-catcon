/**
 * dataExplorer_v3.js  (Module 03)
 * Layout change from v2:
 *   - Callout ("Click any crown…") moved from below the canvas pair
 *     to the TOP of the right toolbar column, so it visually aligns
 *     with the upper panels and the two canvases fill the left column cleanly.
 *   - "same 75 m forest area" bridge connector stays between the canvases.
 *   - All JS logic identical to dataExplorer_v2.js.
 */

import {loadTeachingAssets} from '../assets.js';
import {
  drawApexes, drawChm, drawHistogram,
  drawLasTopView, drawReferenceCrowns, drawSelection,
  localHeights, nearestApex, nearestCrown
} from '../draw.js';

export const dataExplorerModule = {
  html(){
    return `
      <section class="module-grid">
        <div class="panel pad span-12">
          <h2>From 3D LiDAR points to a canopy height model.</h2>
          <p class="intro">This module is only about data representation. LAS shows the sampled 3D evidence; CHM shows the 2D canopy-top surface used by most algorithms in the later labs.</p>
        </div>

        <div class="panel pad span-12">
          <div class="pipeline" id="dataPipeline">
            ${step('point',    'Point cloud',     'LAS stores x, y, and normalized height returns.',                        true)}
            ${step('normalize','Normalize height','Subtract ground elevation to express canopy height.')}
            ${step('raster',   'Rasterize cells', 'Aggregate points within grid cells using max or percentile height.')}
            ${step('chm',      'CHM',             'A 2D height surface makes peaks and valleys visible.')}
          </div>
        </div>

        <div class="panel pad span-12">
          <div class="lab-layout">

            <!-- ── LEFT: 2-column grid (LAS+profile | CHM+selected) then shared controls ── -->
            <div>

              <!-- Row: [LAS canvas | CHM canvas] each with its sub-panel directly below -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">

                <!-- LAS canvas + Local LAS vertical profile directly below -->
                <div style="display:flex;flex-direction:column;gap:10px">
                  <div class="viewer las-viewer">
                    <div class="viewer-head">
                      <div style="display:flex;align-items:center;gap:10px;min-width:0">
                        <span class="viewer-title">LAS sample</span>
                        <span class="viewer-role">input · 3D</span>
                      </div>
                      <span class="chip">60 k pts</span>
                    </div>
                    <canvas id="dataLasCanvas" width="500" height="500"
                            aria-label="Sampled LAS point cloud top view"></canvas>
                  </div>

                  <!-- Local LAS vertical profile — directly below LAS canvas -->
                  <div class="control-group" style="margin:0">
                    <div class="control-title">Local LAS vertical profile</div>
                    <canvas id="dataProfileCanvas" class="profile-canvas"
                            width="500" height="190"></canvas>
                    <p id="dataProfileText" class="card-body" style="margin-top:10px">
                      Click a tree crown to inspect point-height distribution.
                    </p>
                  </div>
                </div>

                <!-- CHM canvas + Selected location directly below -->
                <div style="display:flex;flex-direction:column;gap:10px">
                  <div class="viewer chm-viewer">
                    <div class="viewer-head">
                      <div style="display:flex;align-items:center;gap:10px;min-width:0">
                        <span class="viewer-title">CHM</span>
                        <span class="viewer-role">output · 2D raster</span>
                      </div>
                      <span class="chip">0.15 m</span>
                    </div>
                    <canvas id="dataChmCanvas" width="500" height="500"
                            aria-label="Canopy height model viewer"></canvas>
                  </div>

                  <!-- Selected location — directly below CHM canvas -->
                  <div class="control-group" style="margin:0">
                    <div class="control-title">Selected location</div>
                    <div id="dataSelectedInfo" class="card-body">No location selected.</div>
                  </div>
                </div>
              </div>

              <!-- Bridge connector — only shared element remaining in left column -->
              <div class="canvas-bridge" style="margin-top:18px">
                <span class="canvas-bridge-label">same 75 m forest area</span>
              </div>
            </div>

            <!-- ── RIGHT: status · profile radius · layers · callout ── -->
            <aside class="toolbar">
              <div class="status" id="dataStatus">Loading LiDAR teaching assets…</div>

              <!-- Layer visibility — at top of controls -->
              <div class="control-group">
                <div class="control-title">Layer visibility</div>
                <label class="check"><input type="checkbox" id="dataShowLas"  checked>LAS sample</label>
                <label class="check"><input type="checkbox" id="dataShowRef"  checked>Reference crowns</label>
                <label class="check"><input type="checkbox" id="dataShowApex" checked>Apex points</label>
                <label class="check"><input type="checkbox" id="dataShowEdge" checked>Edge / excluded crowns</label>
              </div>

              <!-- Profile radius — below Layer visibility -->
              <div class="control-group">
                <div class="control-title">
                  Profile radius
                  <span id="dataRadiusValue" class="micro-label" style="margin-left:8px">3.0 m</span>
                </div>
                <input type="range" id="dataRadius" min="1" max="8" step="0.5" value="3">
              </div>

              <!-- Callout — same width as the control groups above, aligned right -->
              <div class="callout" id="dataBridge">
                Click any crown in either view — the same location is highlighted
                in both LAS and CHM so you can see what each representation contributes.
              </div>
            </aside>
          </div>
        </div>

        <div class="panel pad span-12">
          <h3>What each representation provides</h3>
          <table class="info-table">
            <thead>
              <tr><th>Representation</th><th>Provides</th><th>Useful for</th><th>Limits</th></tr>
            </thead>
            <tbody>
              <tr>
                <th style="color:#54b99a">LAS point cloud</th>
                <td>3D returns, vertical structure, point density</td>
                <td>Understanding sensor evidence and local canopy profile</td>
                <td>Too heavy for simple browser algorithms; not directly a smooth crown surface</td>
              </tr>
              <tr>
                <th style="color:#2f8a69">CHM</th>
                <td>2D canopy top height, peaks, valleys, gradients</td>
                <td>Local maxima, watershed, region growing, image-based ML / DL</td>
                <td>Loses understory and within-crown 3D complexity</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  async init(root){
    const abort         = new AbortController();
    const status        = root.querySelector('#dataStatus');
    const lasCanvas     = root.querySelector('#dataLasCanvas');
    const chmCanvas     = root.querySelector('#dataChmCanvas');
    const profileCanvas = root.querySelector('#dataProfileCanvas');
    const lasCtx        = lasCanvas.getContext('2d');
    const chmCtx        = chmCanvas.getContext('2d');
    const profileCtx    = profileCanvas.getContext('2d');
    let state = {selected: null, radius: 3, activeStep: 'point', assets: null};

    const setStatus = (kind, text) => {
      status.className   = `status ${kind || ''}`;
      status.textContent = text;
    };

    const render = () => {
      const {chmImage, refs, apex, points} = state.assets;
      const showRef  = root.querySelector('#dataShowRef').checked;
      const showApex = root.querySelector('#dataShowApex').checked;
      const showEdge = root.querySelector('#dataShowEdge').checked;

      drawLasTopView(lasCtx, points, {
        show: root.querySelector('#dataShowLas').checked,
        selected: state.selected, radius: state.radius
      });
      drawReferenceCrowns(lasCtx, refs, {show: showRef, showEdge});
      drawApexes(lasCtx, apex, {show: showApex});
      drawSelection(lasCtx, state.selected, state.radius);

      drawChm(chmCtx, chmImage);
      drawReferenceCrowns(chmCtx, refs, {show: showRef, showEdge});
      drawApexes(chmCtx, apex, {show: showApex});
      drawSelection(chmCtx, state.selected, state.radius);

      const heights = localHeights(points, state.selected, state.radius);
      drawHistogram(profileCtx, heights);
      updateSelectedInfo(root, state, heights);
    };

    const selectFromEvent = (event, canvas) => {
      const rect     = canvas.getBoundingClientRect();
      state.selected = {
        x: ((event.clientX - rect.left) / rect.width)  * 500,
        y: ((event.clientY - rect.top)  / rect.height) * 500
      };
      render();
    };

    try{
      state.assets = await loadTeachingAssets(true);
      const {points, refs, apex} = state.assets;
      setStatus('ready',
        `CHM loaded · ${points.sample_size.toLocaleString()} sampled LAS points · ` +
        `${refs.summary.display_count} crowns (${refs.summary.eval_count} evaluated) · ` +
        `${apex.summary.eval_count} verified apexes`);
      render();
    }catch(err){
      setStatus('warn', err.message);
      return () => abort.abort();
    }

    root.querySelectorAll('#dataShowLas,#dataShowRef,#dataShowApex,#dataShowEdge').forEach(el =>
      el.addEventListener('change', render, {signal: abort.signal}));

    root.querySelector('#dataRadius').addEventListener('input', event => {
      state.radius = Number(event.target.value);
      root.querySelector('#dataRadiusValue').textContent = `${state.radius.toFixed(1)} m`;
      render();
    }, {signal: abort.signal});

    root.querySelectorAll('.pipeline-step').forEach(step => {
      step.addEventListener('click', () => {
        root.querySelectorAll('.pipeline-step').forEach(s => s.classList.remove('active'));
        step.classList.add('active');
        state.activeStep = step.dataset.step;
        root.querySelector('#dataBridge').textContent = BRIDGE[state.activeStep] || '';
      }, {signal: abort.signal});
    });

    lasCanvas.addEventListener('click', e => selectFromEvent(e, lasCanvas), {signal: abort.signal});
    chmCanvas.addEventListener('click', e => selectFromEvent(e, chmCanvas), {signal: abort.signal});

    return () => abort.abort();
  }
};

/* ── helpers ─────────────────────────────────────────────── */

function step(id, title, body, active = false){
  return `<button class="pipeline-step${active ? ' active' : ''}" data-step="${id}">
    <div class="micro-label">${id}</div><b>${title}</b><p>${body}</p>
  </button>`;
}

const BRIDGE = {
  point:     'LAS is the sampled 3D evidence. Each point has x, y, and height, but the crown boundary is not a ready-made object.',
  normalize: 'Height normalization subtracts terrain so the z value becomes canopy height above ground.',
  raster:    'Rasterization compresses many points into a cell value. This makes the data image-like, but simplifies vertical structure.',
  chm:       'CHM is the surface most ITC algorithms use. It keeps peaks and valleys, making tree detection and delineation tractable.'
};

function updateSelectedInfo(root, state, heights){
  const text  = root.querySelector('#dataProfileText');
  const info  = root.querySelector('#dataSelectedInfo');
  if(!state.selected){
    text.textContent = 'Click a tree crown to inspect point-height distribution.';
    info.innerHTML   = '<span style="color:var(--muted)">No location selected.</span>';
    return;
  }
  if(heights.length){
    text.textContent = `${heights.length.toLocaleString()} sampled LAS points within ${state.radius.toFixed(1)} m · height range ${Math.min(...heights).toFixed(1)}–${Math.max(...heights).toFixed(1)} m.`;
  }else{
    text.textContent = `No sampled LAS points within ${state.radius.toFixed(1)} m. Try a larger radius.`;
  }
  const apex  = nearestApex(state.assets.apex,  state.selected);
  const crown = nearestCrown(state.assets.refs, state.selected);
  const statusColor = crown?.eval_keep ? '#1a5c42' : '#b07b22';
  const statusLabel = crown
    ? (crown.eval_keep ? 'Evaluated complete crown' : 'Edge / excluded crown')
    : 'None nearby';

  info.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="color:var(--muted);padding:3px 0;width:80px">Location</td>
          <td>${state.selected.x.toFixed(0)} px, ${state.selected.y.toFixed(0)} px</td></tr>
      <tr><td style="color:var(--muted);padding:3px 0">LAS pts</td>
          <td>${heights.length.toLocaleString()}</td></tr>
      ${crown ? `
      <tr><td style="color:var(--muted);padding:3px 0">Crown</td>
          <td>#${crown.id}${crown.area_m2 ? ` · ${crown.area_m2.toFixed(1)} m²` : ''}</td></tr>
      <tr><td style="color:var(--muted);padding:3px 0">Status</td>
          <td style="color:${statusColor};font-weight:700">${statusLabel}</td></tr>
      ` : `<tr><td style="color:var(--muted);padding:3px 0">Crown</td>
               <td style="color:var(--muted)">None nearby</td></tr>`}
      ${apex ? `
      <tr><td style="color:var(--muted);padding:3px 0">Apex</td>
          <td>tree_id ${apex.tree_id ?? '—'} · ${apex.distance_px?.toFixed(1)} px</td></tr>
      ` : `<tr><td style="color:var(--muted);padding:3px 0">Apex</td>
               <td style="color:var(--muted)">None nearby</td></tr>`}
    </table>
  `;
}
