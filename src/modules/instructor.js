import {loadJson, loadModelAssets} from '../assets.js';

export const instructorModule = {
  html(){
    return `
      <section class="module-grid">
        <div class="panel pad span-12">
          <h2>Instructor Console</h2>
          <p class="intro">A short teaching-package guide for instructors and reviewers: what the data are, how references are used, how scores should be read, and what is real versus precomputed.</p>
        </div>

        <div class="panel pad span-12">
          <div class="instructor-toolbar">
            <div class="status" id="instructorStatus">Loading teaching package assets...</div>
            <div class="btn-row">
              <button class="btn" id="copyMethodsNote">Copy methods note</button>
              <button class="btn" id="copyTeachingChecklist">Copy checklist</button>
              <button class="btn" id="printInstructorPage">Print</button>
            </div>
          </div>
        </div>

        <div class="panel pad span-12">
          <h3>Teaching flow</h3>
          <div class="pipeline instructor-pipeline compact-flow">
            ${flowStep('1 Data','LAS to CHM: what 3D points and 2D height surfaces each reveal.')}
            ${flowStep('2 Classical','Local maxima, watershed, region growing, and where rules fail.')}
            ${flowStep('3 Features','Hand-crafted cues as a bridge to learned representations.')}
            ${flowStep('4 DL + Eval','Mask R-CNN, YOLO, SAM-assisted outputs on the same CHM/reference.')}
            ${flowStep('5 Workbook','Students mark, tune, compare, prompt, and submit a report.')}
          </div>
        </div>

        <div class="panel pad span-6">
          <h3>Dataset and reference</h3>
          <div id="compactDataset">Loading...</div>
        </div>

        <div class="panel pad span-6">
          <h3>Evaluation and honesty boundary</h3>
          <table class="info-table compact-table">
            <tbody>
              <tr><th>Apex F1</th><td>Scores treetop location detection. It does not prove crown boundaries are good.</td></tr>
              <tr><th>Mean IoU</th><td>Scores overlap quality for matched crown masks or polygons.</td></tr>
              <tr><th>Edge crowns</th><td>May be displayed for teaching, but partial/edge crowns are excluded from evaluation.</td></tr>
              <tr><th>DL outputs</th><td>Mask R-CNN, YOLO, and YOLO-Seg overlays are precomputed model outputs, not live training.</td></tr>
              <tr><th>SAM</th><td>SAM-assisted masks use expert apex prompts; teach this as human-in-the-loop segmentation.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel pad span-12">
          <h3>Package health</h3>
          <div id="compactHealth" class="compact-health-grid">Loading...</div>
        </div>

        <div class="panel pad span-7">
          <h3>Copyable methods note</h3>
          <textarea id="methodsNote" class="student-report compact-methods" readonly></textarea>
        </div>

        <div class="panel pad span-5">
          <h3>Teaching checklist</h3>
          <div id="teachingChecklist" class="checklist"></div>
          <div class="callout" style="margin-top:14px">Student Workbook hides reference crowns and apexes by default. Reveal them only for feedback or instructor demonstration.</div>
        </div>
      </section>
    `;
  },
  async init(root){
    const abort = new AbortController();
    const status = root.querySelector('#instructorStatus');
    const state = {assets:null, grid:null, points:null, meta:null};

    const setStatus = (kind, text)=>{
      status.className = `status ${kind || ''}`;
      status.textContent = text;
    };

    try{
      const [assets, grid, points] = await Promise.all([
        loadModelAssets(),
        loadJson('assets/chm_grid.json'),
        loadJson('assets/points_sample.json')
      ]);
      state.assets = assets;
      state.grid = grid;
      state.points = points;
      state.meta = assets.meta;
      setStatus('ready', `Loaded: ${assets.refs.summary.eval_count} evaluated crowns, ${assets.apex.summary.eval_count} evaluated apexes, ${points.points.length.toLocaleString()} LAS sample points, and 4 model-output layers.`);
      renderInstructor(root, state);
      bindInstructor(root, state, abort.signal);
    }catch(err){
      setStatus('warn', `Could not load teaching package assets: ${err.message}`);
    }

    return () => abort.abort();
  }
};

function flowStep(title, body){
  return `<div class="pipeline-step"><div class="micro-label">${title}</div><p>${body}</p></div>`;
}

function bindInstructor(root, state, signal){
  root.querySelector('#copyMethodsNote').addEventListener('click', ()=>copyFrom(root, '#methodsNote', 'Methods note copied.'), {signal});
  root.querySelector('#copyTeachingChecklist').addEventListener('click', async ()=>{
    await copyText(root, checklistText(state), 'Teaching checklist copied.');
  }, {signal});
  root.querySelector('#printInstructorPage').addEventListener('click', ()=>window.print(), {signal});
}

function renderInstructor(root, state){
  renderDataset(root, state);
  renderHealth(root, state);
  root.querySelector('#methodsNote').value = methodsNote(state);
}

function renderDataset(root, state){
  const meta = state.meta;
  const chm = meta.source_metadata.chm;
  const las = meta.source_metadata.las;
  const refs = state.assets.refs.summary;
  const apex = state.assets.apex.summary;
  root.querySelector('#compactDataset').innerHTML = `
    <table class="info-table compact-table">
      <tbody>
        <tr><th>Study subset</th><td>${meta.source_metadata.name}, ${meta.source_metadata.crs}, 75 m x 75 m airborne LiDAR crop.</td></tr>
        <tr><th>CHM</th><td>${chm.width_px} x ${chm.height_px} px at ${chm.resolution_m} m; max height ${chm.max_height_m} m.</td></tr>
        <tr><th>LAS</th><td>${las.point_count.toLocaleString()} cropped points; ${state.points.points.length.toLocaleString()} sampled for browser display.</td></tr>
        <tr><th>Reference</th><td>${refs.display_count} display crowns, ${refs.eval_count} evaluated crowns, ${refs.partial_count} partial/edge crowns; ${apex.eval_count} evaluated apexes.</td></tr>
        <tr><th>Models</th><td>Mask R-CNN polygons, YOLO-Seg masks, YOLO boxes, and SAM-assisted apex-prompt masks.</td></tr>
        <tr><th>Sensor expansion</th><td>UAV and single-photon LiDAR should be used as sensor-comparison modules unless matched references are prepared.</td></tr>
      </tbody>
    </table>
  `;
}

function renderHealth(root, state){
  const a = state.assets;
  const items = [
    ['CHM', `${a.chmImage.naturalWidth || 500} x ${a.chmImage.naturalHeight || 500}px image + ${state.grid.width} x ${state.grid.height} grid`],
    ['LAS sample', `${state.points.points.length.toLocaleString()} browser points`],
    ['Reference', `${a.refs.summary.eval_count} crowns + ${a.apex.summary.eval_count} apexes`],
    ['DL overlays', `${a.mrcnn.objects.length} MRCNN, ${a.yoloSeg.objects.length} YOLO-Seg, ${a.yoloDet.objects.length} boxes`],
    ['SAM-assisted', `${a.samApex.objects.length} prompt masks`],
    ['Student-safe', 'Reference layers hidden by default']
  ];
  root.querySelector('#compactHealth').innerHTML = items.map(([title, body])=>`
    <div class="health-card"><span class="status-pill">Loaded</span><b>${title}</b><small>${body}</small></div>
  `).join('');

  root.querySelector('#teachingChecklist').innerHTML = checklistItems(state).map(item=>`
    <label class="check checklist-item"><input type="checkbox" checked disabled>${item}</label>
  `).join('');
}

function checklistItems(state){
  return [
    `CHM and LAS sample load correctly.`,
    `${state.assets.refs.summary.eval_count} evaluated crowns and ${state.assets.apex.summary.eval_count} evaluated apexes are available.`,
    `Reference layers are hidden by default in Student Workbook.`,
    `Classical methods compute live in the browser.`,
    `DL and SAM-assisted layers are clearly marked as precomputed outputs.`,
    `UAV / single-photon LiDAR are not mixed into this evaluation set without matched references.`
  ];
}

function checklistText(state){
  return checklistItems(state).map(item=>`[x] ${item}`).join('\n');
}

function methodsNote(state){
  const a = state.assets;
  const meta = state.meta;
  return [
    'TreeSeg Lab Methods Note',
    '',
    `Teaching subset: ${meta.source_metadata.name}, ${meta.source_metadata.crs}, 75 m x 75 m airborne LiDAR crop.`,
    `CHM: ${meta.source_metadata.chm.width_px} x ${meta.source_metadata.chm.height_px} px at ${meta.source_metadata.chm.resolution_m} m resolution; max height ${meta.source_metadata.chm.max_height_m} m.`,
    `LAS: ${meta.source_metadata.las.point_count.toLocaleString()} cropped points; ${state.points.points.length.toLocaleString()} sampled points used for browser display.`,
    `Reference: ${a.refs.summary.display_count} display crowns, ${a.refs.summary.eval_count} evaluated crowns, ${a.refs.summary.partial_count} partial/edge crowns, and ${a.apex.summary.eval_count} evaluated apex points.`,
    '',
    'Evaluation: apex detection is scored with point matching; crown delineation is summarized with matched mask/polygon IoU. Partial or edge crowns may be shown for teaching but are excluded from evaluation.',
    '',
    `Model outputs: Mask R-CNN F1 ${metricValue(a.mrcnn, 'f1')}; YOLO-Seg F1 ${metricValue(a.yoloSeg, 'f1')}; YOLO box F1 ${metricValue(a.yoloDet, 'f1')}; SAM-assisted F1 ${metricValue(a.samApex, 'f1')}.`,
    '',
    'Honesty boundary: classical methods run live in the browser. Deep-learning layers are precomputed. SAM-assisted masks use expert apex prompts and should be taught as human-in-the-loop segmentation, not full automatic ITC detection.',
    '',
    'Extension: UAV and single-photon LiDAR can be added as sensor-comparison modules. They should not be mixed into this evaluation set unless coverage and reference crowns/apexes are matched.'
  ].join('\n');
}

function metricValue(layer, key){
  const value = layer && layer.metrics ? Number(layer.metrics[key]) : NaN;
  return Number.isFinite(value) ? value.toFixed(2) : '--';
}

async function copyFrom(root, selector, success){
  const text = root.querySelector(selector).value || root.querySelector(selector).textContent || '';
  await copyText(root, text, success);
}

async function copyText(root, text, success){
  const status = root.querySelector('#instructorStatus');
  try{
    await navigator.clipboard.writeText(text);
    status.className = 'status ready';
    status.textContent = success;
  }catch{
    status.className = 'status warn';
    status.textContent = 'Copy failed; select the text manually.';
  }
}
