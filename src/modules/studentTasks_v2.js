/**
 * studentTasks_v2.js
 * Changes from original studentTasks.js:
 *   1. All computation functions replaced by imports from compute.js (DRY fix)
 *   2. Task 2 now offers 3 patch presets (matching Classical Lab), not a single fixed patch
 *   3. SAM prompt quality shows distance in both px and metres
 *   4. Task 3 DL comparison shows auto-generated error hint (TP/FP/FN analysis)
 */

import {loadJson, loadModelAssets} from '../assets.js';
import {
  drawApexes, drawChm, drawMethodObjects, drawReferenceCrowns
} from '../draw.js';
import {
  clamp, extractPatch, smoothPatch, detectLocalMaxima,
  watershedLabels, regionGrowLabels, cellToGlobalPx,
  referenceApexesInPatch, matchApexes,
  drawHeightRaster, drawSegmentation, drawTops,
  drawPatchCrowns, drawPatchApexes, drawCanvasCaption
} from '../compute.js';

/* ── constants ────────────────────────────────────────────── */

const TASKS = [
  {id:'apex',      label:'1 Mark Apexes',    title:'Mark tree apexes',             mode:'Click likely treetops on the CHM.'},
  {id:'classical', label:'2 Tune Classical',  title:'Tune classical parameters',    mode:'Change rules and diagnose scale dependency.'},
  {id:'dl',        label:'3 Compare DL',      title:'Compare deep learning outputs',mode:'Read model outputs as evidence, not decoration.'},
  {id:'sam',       label:'4 SAM Prompt',      title:'Try SAM-style prompt logic',   mode:'Click where an expert prompt would go.'},
  {id:'report',    label:'5 Report',          title:'Generate learning report',      mode:'Turn interactions into a compact lab note.'}
];

// Three patch presets (same as Classical Lab) — Task 2 now lets students choose
const CLASSIC_CASES = [
  {id:'open',  label:'Open crowns',    center:[215,204], note:'Clear peaks and visible valleys.'},
  {id:'dense', label:'Dense canopy',   center:[130,188], note:'Crowded crowns and weak valleys.'},
  {id:'edge',  label:'Edge / partial', center:[479,420], note:'Partial crowns near the patch boundary.'}
];
const PATCH_PX      = 120;
const MATCH_TOL_PX  = 16;

// CHM px → metres (500px canvas = 75m → 1px = 0.15m)
const PX_TO_M = 0.15;

const MODEL_OPTIONS = {
  mrcnn:   {label:'Mask R-CNN',    asset:'mrcnn',   stroke:'rgba(45,100,133,.95)', fill:'rgba(45,100,133,.10)', boxes:false},
  yoloSeg: {label:'YOLO-Seg',      asset:'yoloSeg', stroke:'rgba(52,127,145,.95)', fill:'rgba(52,127,145,.15)', boxes:false},
  yoloDet: {label:'YOLO boxes',    asset:'yoloDet', stroke:'rgba(201,95,39,.96)',  fill:'rgba(201,95,39,.045)', boxes:true},
  samApex: {label:'SAM-assisted',  asset:'samApex', stroke:'rgba(176,123,34,.96)', fill:'rgba(235,219,118,.15)',boxes:false}
};

/* ── module ──────────────────────────────────────────────── */

export const studentTasksModule = {
  html(){
    return `
      <section class="module-grid">
        <div class="panel pad span-12">
          <h2>Student Workbook</h2>
          <p class="intro">A compact lab practical that asks students to apply the previous modules: observe CHM evidence, mark treetops, tune a classical method, compare deep-learning outputs, reason about SAM prompts, and produce a short report.</p>
        </div>

        <div class="panel pad span-12">
          <div class="student-steps" role="tablist" aria-label="Student task steps">
            ${TASKS.map((t,i)=>`<button class="student-step" data-student-step="${t.id}" aria-pressed="${i===0?'true':'false'}"><span>${t.label}</span><small>${t.mode}</small></button>`).join('')}
          </div>
        </div>

        <div class="student-workbench span-12">
          <div class="panel pad">
            <div class="viewer">
              <div class="viewer-head">
                <div>
                  <div class="viewer-title" id="studentCanvasTitle">Student task canvas</div>
                  <div class="micro-label" id="studentCanvasMode">Loading assets</div>
                </div>
                <span class="concept-chip" id="studentCanvasBadge">workbook</span>
              </div>
              <canvas id="studentCanvas" width="500" height="500" aria-label="Student task interactive CHM canvas"></canvas>
            </div>
            <div class="legend student-legend" id="studentLegend"></div>
          </div>

          <aside class="toolbar">
            <div class="status" id="studentStatus">Loading teaching assets...</div>

            <div class="control-group">
              <div class="control-title">Layer visibility</div>
              <label class="check"><input type="checkbox" data-student-layer="studentMarks"   checked>Student marks / prompts</label>
              <label class="check"><input type="checkbox" data-student-layer="modelOutput"    checked>Model or algorithm output</label>
              <label class="check"><input type="checkbox" data-student-layer="referenceCrowns">Reference crowns</label>
              <label class="check"><input type="checkbox" data-student-layer="referenceApexes">Reference apexes</label>
            </div>

            <!-- Task 1: apex marking -->
            <div class="student-task-panel" data-task-panel="apex">
              <div class="control-group">
                <div class="control-title">Task 1 · Mark apexes</div>
                <p class="card-body">Click up to 20 likely tree tops. Scoring uses the hidden reference; the reference display is controlled separately above.</p>
                <div class="btn-row">
                  <button class="btn primary" id="studentCompareApex">Score my marks</button>
                  <button class="btn" id="studentUndoMark">Undo</button>
                  <button class="btn" id="studentClearMarks">Clear</button>
                </div>
              </div>
              <div class="metric-grid">
                ${metric('Marks','studentApexN')}
                ${metric('Apex F1','studentApexF1')}
                ${metric('Precision','studentApexPrecision')}
                ${metric('Recall','studentApexRecall')}
                <div class="metric-band" id="studentApexDetail">Not scored yet. Reference display is optional.</div>
              </div>
              ${noteBox('studentApexNote','Reflection: Which crowns were uncertain, suppressed, or hard to interpret?')}
            </div>

            <!-- Task 2: classical tuning — now with patch selector -->
            <div class="student-task-panel" data-task-panel="classical" hidden>
              <div class="control-group">
                <div class="control-title">Task 2 · Tune classical parameters</div>
                <div class="segmented" role="group" aria-label="Choose patch for Task 2" style="margin-bottom:10px">
                  ${CLASSIC_CASES.map(c=>`<button data-classic2-case="${c.id}" aria-pressed="${c.id==='open'?'true':'false'}">${c.label}</button>`).join('')}
                </div>
                <p class="card-body" id="studentClassicCaseNote">${CLASSIC_CASES[0].note}</p>
                <p class="card-body" style="margin-top:4px">Find a useful detection F1, then explain what the boundary overlay still gets wrong.</p>
                ${rangeControl('studentSigma',     'Gaussian smoothing (&sigma;)','0','3','0.1','1.0')}
                ${rangeControl('studentWindow',     'Search window (CHM px)',       '3','37','2','5')}
                ${rangeControl('studentMinHeight',  'Min tree height (m)',          '2','22','0.5','6')}
                <div class="segmented" role="group" aria-label="Student classical method" style="margin-top:8px">
                  <button id="studentWatershed" aria-pressed="true">Watershed</button>
                  <button id="studentRegion"    aria-pressed="false">Region growing</button>
                </div>
                <div class="btn-row" style="margin-top:10px">
                  <button class="btn primary" id="studentSaveClassic">Save current result</button>
                </div>
              </div>
              <div class="metric-grid">
                ${metric('F1','studentClassicF1')}
                ${metric('Treetops','studentClassicN')}
                ${metric('Precision','studentClassicPrecision')}
                ${metric('Recall','studentClassicRecall')}
                <div class="metric-band" id="studentClassicBest">Saved result: none yet.</div>
              </div>
              ${noteBox('studentClassicNote','Reflection: Why can a good apex F1 still leave poor crown boundaries?')}
            </div>

            <!-- Task 3: DL comparison — now with auto error hint -->
            <div class="student-task-panel" data-task-panel="dl" hidden>
              <div class="control-group">
                <div class="control-title">Task 3 · Compare DL outputs</div>
                <p class="card-body">Switch models, inspect the same forest, and tag the most visible failure mode.</p>
                <div class="segmented" role="group" aria-label="Choose model for student comparison">
                  ${Object.entries(MODEL_OPTIONS).map(([id,m],i)=>`<button data-student-model="${id}" aria-pressed="${i===0?'true':'false'}">${m.label}</button>`).join('')}
                </div>
              </div>
              <div class="metric-grid">
                ${metric('Model F1','studentDlF1')}
                ${metric('Mean IoU','studentDlIou')}
                ${metric('Objects','studentDlObjects')}
                ${metric('Reference','studentDlReference')}
              </div>
              <!-- Auto hint based on actual TP/FP/FN -->
              <div class="callout" id="studentDlHint" style="margin:0;font-size:13px">Select a model to see error analysis.</div>
              <div class="control-group">
                <div class="control-title">Failure tags</div>
                <div class="tag-grid">
                  ${['omission','commission','split','merge','coarse boundary','edge crown'].map(tag=>`<label class="check"><input type="checkbox" data-dl-error="${tag}">${tag}</label>`).join('')}
                </div>
              </div>
              ${noteBox('studentDlNote','Reflection: Which model changed the ITC problem the most, and what weakness remains?')}
            </div>

            <!-- Task 4: SAM prompt -->
            <div class="student-task-panel" data-task-panel="sam" hidden>
              <div class="control-group">
                <div class="control-title">Task 4 · SAM prompt logic</div>
                <p class="card-body">Click a likely apex or ambiguous crown center. The nearest precomputed SAM-assisted mask will appear.</p>
                <div class="btn-row">
                  <button class="btn primary" id="studentAcceptSam">Accept mask</button>
                  <button class="btn" id="studentRejectSam">Reject mask</button>
                  <button class="btn" id="studentClearPrompt">Clear prompt</button>
                </div>
              </div>
              <div class="metric-grid">
                ${metric('Prompt distance','studentSamDistance')}
                ${metric('Prompt quality','studentSamQuality')}
                ${metric('SAM score','studentSamScore')}
                ${metric('Decision','studentSamDecision')}
              </div>
              <div class="callout" id="studentSamHint" style="margin:0;font-size:13px">
                <b>Quality thresholds</b>: strong ≤8 px (≤1.2 m), usable ≤18 px (≤2.7 m), risky &gt;18 px (&gt;2.7 m). 1 px = 0.15 m at this CHM resolution.
              </div>
              ${noteBox('studentSamNote','Reflection: Where would an expert click, and when would human review still be needed?')}
            </div>

            <!-- Task 5: report -->
            <div class="student-task-panel" data-task-panel="report" hidden>
              <div class="control-group">
                <div class="control-title">Task 5 · Submit report</div>
                <p class="card-body">This report is generated from the interactions and notes in this workbook.</p>
                <div class="btn-row">
                  <button class="btn primary" id="studentRefreshReport">Refresh report</button>
                  <button class="btn" id="studentCopyReport">Copy text</button>
                </div>
              </div>
              <textarea id="studentReport" class="student-report" readonly></textarea>
            </div>
          </aside>
        </div>

        <div class="panel span-12">
          <div class="lesson-list teaching-table">
            <div class="lesson-row"><div class="micro-label">Purpose</div><div>Students apply the same evidence chain: CHM observation, treetop detection, crown delineation, model comparison, and evaluation.</div></div>
            <div class="lesson-row"><div class="micro-label">Assessment</div><div>The page records measurable actions, but the written reflections are equally important because ITC errors are spatial and interpretive.</div></div>
            <div class="lesson-row"><div class="micro-label">CATCON fit</div><div>This turns the webapp into computer-assisted teaching software: students manipulate data, receive immediate feedback, and produce a reusable lab note.</div></div>
          </div>
        </div>
      </section>
    `;
  },

  async init(root){
    const abort  = new AbortController();
    const canvas = root.querySelector('#studentCanvas');
    const ctx    = canvas.getContext('2d');
    const status = root.querySelector('#studentStatus');
    const state  = {
      task:'apex', assets:null, grid:null,
      studentMarks:[], showApexReference:false,
      layers:{studentMarks:true, modelOutput:true, referenceCrowns:false, referenceApexes:false},
      classic:{sigma:1, windowPx:5, minHeight:6, method:'watershed', caseId:'open', latest:null, saved:null},
      dl:{model:'mrcnn', errors:new Set()},
      sam:{prompt:null, object:null, decision:'pending'}
    };

    const setStatus = (kind, text) => {
      status.className   = `status ${kind || ''}`;
      status.textContent = text;
    };

    const updateAll = () => {
      updatePanels(root, state);
      renderCanvas(root, ctx, state);
      updateMetrics(root, state);
      updateReport(root, state);
    };

    try{
      const [assets, grid] = await Promise.all([
        loadModelAssets(),
        loadJson('assets/chm_grid.json')
      ]);
      state.assets = assets;
      state.grid   = grid;
      setStatus('ready', `Loaded workbook assets: ${assets.refs.summary.display_count} crowns, ${assets.apex.summary.eval_count} evaluated apexes, and four model-output layers.`);
      bindStudentControls(root, canvas, state, abort.signal, updateAll);
      updateAll();
    }catch(err){
      setStatus('warn', `Could not load student task assets: ${err.message}`);
      return () => abort.abort();
    }
    return () => abort.abort();
  }
};

/* ── HTML helpers ─────────────────────────────────────────── */

function metric(label, id){
  return `<div class="metric"><div class="metric-key">${label}</div><div class="metric-val" id="${id}">--</div></div>`;
}
function noteBox(id, placeholder){
  return `<textarea id="${id}" class="student-note" placeholder="${placeholder}"></textarea>`;
}
function rangeControl(id, label, min, max, step, value){
  return `
    <label class="check" for="${id}" style="justify-content:space-between">
      <span>${label}</span><span class="micro-label" id="${id}Val">${value}</span>
    </label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
  `;
}

/* ── event bindings ───────────────────────────────────────── */

function bindStudentControls(root, canvas, state, signal, updateAll){
  root.querySelectorAll('[data-student-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.task = btn.dataset.studentStep;
      root.querySelectorAll('[data-student-step]').forEach(b => b.setAttribute('aria-pressed','false'));
      btn.setAttribute('aria-pressed','true');
      updateAll();
    }, {signal});
  });

  root.querySelectorAll('[data-student-layer]').forEach(input => {
    input.addEventListener('change', () => {
      state.layers[input.dataset.studentLayer] = input.checked;
      updateAll();
    }, {signal});
  });

  // Task 1
  root.querySelector('#studentCompareApex').addEventListener('click', () => { state.showApexReference = true; updateAll(); }, {signal});
  root.querySelector('#studentUndoMark').addEventListener('click', () => { state.studentMarks.pop(); updateAll(); }, {signal});
  root.querySelector('#studentClearMarks').addEventListener('click', () => { state.studentMarks = []; state.showApexReference = false; updateAll(); }, {signal});

  // Task 2 — patch selector
  root.querySelectorAll('[data-classic2-case]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-classic2-case]').forEach(b => b.setAttribute('aria-pressed','false'));
      btn.setAttribute('aria-pressed','true');
      state.classic.caseId = btn.dataset.classic2Case;
      const note = CLASSIC_CASES.find(c => c.id === state.classic.caseId)?.note || '';
      root.querySelector('#studentClassicCaseNote').textContent = note;
      updateAll();
    }, {signal});
  });

  const bindRange = (id, key, fmt) => {
    const input = root.querySelector(`#${id}`);
    const val   = root.querySelector(`#${id}Val`);
    input.addEventListener('input', () => {
      state.classic[key] = Number(input.value);
      val.textContent    = fmt(state.classic[key]);
      updateAll();
    }, {signal});
    val.textContent = fmt(Number(input.value));
  };
  bindRange('studentSigma',    'sigma',    v => v.toFixed(1));
  bindRange('studentWindow',   'windowPx', v => String(Math.round(v)));
  bindRange('studentMinHeight','minHeight',v => v.toFixed(1));

  const setClassicMethod = method => {
    state.classic.method = method;
    root.querySelector('#studentWatershed').setAttribute('aria-pressed', method === 'watershed' ? 'true' : 'false');
    root.querySelector('#studentRegion').setAttribute('aria-pressed',    method === 'region'    ? 'true' : 'false');
    updateAll();
  };
  root.querySelector('#studentWatershed').addEventListener('click', () => setClassicMethod('watershed'), {signal});
  root.querySelector('#studentRegion').addEventListener('click',    () => setClassicMethod('region'),    {signal});
  root.querySelector('#studentSaveClassic').addEventListener('click', () => { state.classic.saved = {...state.classic.latest}; updateAll(); }, {signal});

  // Task 3
  root.querySelectorAll('[data-student-model]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.dl.model = btn.dataset.studentModel;
      root.querySelectorAll('[data-student-model]').forEach(b => b.setAttribute('aria-pressed','false'));
      btn.setAttribute('aria-pressed','true');
      updateAll();
    }, {signal});
  });
  root.querySelectorAll('[data-dl-error]').forEach(input => {
    input.addEventListener('change', () => {
      if(input.checked) state.dl.errors.add(input.dataset.dlError);
      else              state.dl.errors.delete(input.dataset.dlError);
      updateAll();
    }, {signal});
  });

  // Task 4
  root.querySelector('#studentAcceptSam').addEventListener('click', () => { state.sam.decision = state.sam.object ? 'accepted' : 'no prompt'; updateAll(); }, {signal});
  root.querySelector('#studentRejectSam').addEventListener('click', () => { state.sam.decision = state.sam.object ? 'rejected' : 'no prompt'; updateAll(); }, {signal});
  root.querySelector('#studentClearPrompt').addEventListener('click', () => { state.sam = {prompt:null, object:null, decision:'pending'}; updateAll(); }, {signal});

  // Task 5
  root.querySelector('#studentRefreshReport').addEventListener('click', () => updateReport(root, state), {signal});
  root.querySelector('#studentCopyReport').addEventListener('click', async () => {
    const text = root.querySelector('#studentReport').value;
    try{
      await navigator.clipboard.writeText(text);
      root.querySelector('#studentStatus').textContent = 'Report copied to clipboard.';
    }catch{ root.querySelector('#studentStatus').textContent = 'Copy failed; select the report text manually.'; }
  }, {signal});

  root.querySelectorAll('.student-note').forEach(el => el.addEventListener('input', () => updateReport(root, state), {signal}));

  canvas.addEventListener('click', event => {
    const p = canvasPoint(canvas, event);
    if(state.task === 'apex'){
      if(state.studentMarks.length < 20) state.studentMarks.push(p);
    }else if(state.task === 'sam'){
      state.sam.prompt  = p;
      state.sam.object  = nearestSamObject(state.assets.samApex.objects, p);
      state.sam.decision = 'pending';
    }
    updateAll();
  }, {signal});
}

/* ── rendering ────────────────────────────────────────────── */

function updatePanels(root, state){
  const task = TASKS.find(t => t.id === state.task) || TASKS[0];
  root.querySelector('#studentCanvasTitle').textContent  = task.title;
  root.querySelector('#studentCanvasMode').textContent   = task.mode;
  root.querySelector('#studentCanvasBadge').textContent  = state.task === 'report' ? 'report' : 'interactive';
  root.querySelectorAll('[data-task-panel]').forEach(panel => {
    panel.hidden = panel.dataset.taskPanel !== state.task;
  });
}

function renderCanvas(root, ctx, state){
  if(!state.assets) return;
  if(state.task === 'classical')     renderClassicalCanvas(ctx, state);
  else if(state.task === 'dl')       renderDlCanvas(ctx, state);
  else if(state.task === 'sam')      renderSamCanvas(ctx, state);
  else if(state.task === 'report')   renderReportCanvas(ctx, state);
  else                               renderApexCanvas(ctx, state);
  root.querySelector('#studentLegend').innerHTML = legendForTask(state.task, state);
}

function renderApexCanvas(ctx, state){
  const a       = state.assets;
  const details = matchApexes(state.studentMarks, activeApexRefs(a), MATCH_TOL_PX);
  drawChm(ctx, a.chmImage);
  drawReferenceCrowns(ctx, a.refs, {show:state.layers.referenceCrowns, showEdge:false});
  drawApexes(ctx, a.apex, {show:state.layers.referenceApexes});
  if(state.layers.studentMarks) drawStudentMarks(ctx, state.studentMarks, state.showApexReference ? details : null);
  drawCanvasCaption(ctx, state.showApexReference
    ? `${details.tp} matched | ${details.fp} extra | ${details.fn} missed`
    : `${state.studentMarks.length}/20 student apex marks`);
}

function renderClassicalCanvas(ctx, state){
  const current = CLASSIC_CASES.find(c => c.id === state.classic.caseId) || CLASSIC_CASES[0];
  const patch   = extractPatch(state.grid, current.center, PATCH_PX);
  const values  = smoothPatch(patch, state.classic.sigma);
  const tops    = detectLocalMaxima(values, patch.size, state.classic.minHeight, state.classic.windowPx, patch.stride);
  const labels  = state.classic.method === 'watershed'
    ? watershedLabels(values, patch.size, tops, state.classic.minHeight)
    : regionGrowLabels(values, patch.size, tops, state.classic.minHeight);
  drawHeightRaster(ctx, values, patch.size);
  if(state.layers.modelOutput){ drawSegmentation(ctx, labels, patch.size); drawTops(ctx, tops, patch.size); }
  if(state.layers.referenceCrowns) drawPatchCrowns(ctx, state.assets.refs, patch);
  if(state.layers.referenceApexes) drawPatchApexes(ctx, state.assets.apex, patch, {evalOnly:true});
  const refs       = referenceApexesInPatch(state.assets.apex, patch);
  const detections = tops.map(t => cellToGlobalPx(t, patch));
  const metrics    = matchApexes(detections, refs, 15);
  state.classic.latest = {
    sigma:state.classic.sigma, windowPx:state.classic.windowPx,
    minHeight:state.classic.minHeight, method:state.classic.method,
    caseId:state.classic.caseId, tops:tops.length, refs:refs.length, ...metrics
  };
  drawCanvasCaption(ctx, `${state.classic.method} | F1 ${metrics.f1.toFixed(2)} | ${tops.length} treetops`);
}

function renderDlCanvas(ctx, state){
  const a      = state.assets;
  const option = MODEL_OPTIONS[state.dl.model] || MODEL_OPTIONS.mrcnn;
  const layer  = a[option.asset];
  drawChm(ctx, a.chmImage);
  if(state.layers.modelOutput) drawMethodObjects(ctx, layer.objects, option.stroke, option.fill, {lineWidth:option.boxes ? 1.5 : 1.35, boxes:option.boxes});
  drawReferenceCrowns(ctx, a.refs, {show:state.layers.referenceCrowns, showEdge:false});
  drawApexes(ctx, a.apex, {show:state.layers.referenceApexes});
  drawCanvasCaption(ctx, `${option.label} | F1 ${metricVal(layer,'f1')} | mean IoU ${metricVal(layer,'mean_iou_matched')}`);
}

function renderSamCanvas(ctx, state){
  const a = state.assets;
  drawChm(ctx, a.chmImage);
  drawReferenceCrowns(ctx, a.refs, {show:state.layers.referenceCrowns, showEdge:false});
  drawApexes(ctx, a.apex, {show:state.layers.referenceApexes});
  if(state.sam.object && state.layers.modelOutput){
    drawMethodObjects(ctx, [state.sam.object], 'rgba(176,123,34,.98)', 'rgba(235,219,118,.22)', {lineWidth:2});
    drawPromptPoint(ctx, {x:state.sam.object.prompt_point_px[0], y:state.sam.object.prompt_point_px[1]}, '#f0da70', 5);
  }
  if(state.sam.prompt && state.layers.studentMarks) drawPromptPoint(ctx, state.sam.prompt, '#2d6485', 7);
  drawCanvasCaption(ctx, state.sam.prompt ? samQuality(state.sam).label : 'Click a prompt point');
}

function renderReportCanvas(ctx, state){
  const a     = state.assets;
  const model = MODEL_OPTIONS[state.dl.model] || MODEL_OPTIONS.mrcnn;
  const layer = a[model.asset];
  drawChm(ctx, a.chmImage);
  if(state.layers.modelOutput){
    drawMethodObjects(ctx, layer.objects, model.stroke, model.fill, {lineWidth:model.boxes ? 1.35 : 1.2, boxes:model.boxes});
    if(state.sam.object) drawMethodObjects(ctx, [state.sam.object], 'rgba(176,123,34,.98)', 'rgba(235,219,118,.18)', {lineWidth:1.8});
  }
  drawReferenceCrowns(ctx, a.refs, {show:state.layers.referenceCrowns, showEdge:false});
  drawApexes(ctx, a.apex, {show:state.layers.referenceApexes});
  if(state.layers.studentMarks){
    const details = matchApexes(state.studentMarks, activeApexRefs(a), MATCH_TOL_PX);
    drawStudentMarks(ctx, state.studentMarks, state.showApexReference ? details : null);
    if(state.sam.prompt) drawPromptPoint(ctx, state.sam.prompt, '#2d6485', 7);
  }
  drawCanvasCaption(ctx, `report | ${state.studentMarks.length} apex marks | ${model.label} | SAM ${state.sam.decision}`);
}

/* ── metrics ──────────────────────────────────────────────── */

function updateMetrics(root, state){
  const a = state.assets;
  if(!a) return;

  // Task 1
  const apex = matchApexes(state.studentMarks, activeApexRefs(a), MATCH_TOL_PX);
  root.querySelector('#studentApexN').textContent         = `${state.studentMarks.length}/20`;
  root.querySelector('#studentApexF1').textContent        = state.studentMarks.length ? apex.f1.toFixed(2) : '--';
  root.querySelector('#studentApexPrecision').textContent = state.studentMarks.length ? apex.precision.toFixed(2) : '--';
  root.querySelector('#studentApexRecall').textContent    = state.studentMarks.length ? apex.recall.toFixed(2) : '--';
  root.querySelector('#studentApexDetail').textContent    = state.showApexReference
    ? `${apex.tp} matched, ${apex.fp} extra, ${apex.fn} missed within ${MATCH_TOL_PX} px.`
    : 'Not scored yet. Use "Score my marks" when ready.';

  // Task 2
  const classic = state.classic.latest;
  root.querySelector('#studentClassicF1').textContent        = classic ? classic.f1.toFixed(2) : '--';
  root.querySelector('#studentClassicN').textContent         = classic ? String(classic.tops) : '--';
  root.querySelector('#studentClassicPrecision').textContent = classic ? classic.precision.toFixed(2) : '--';
  root.querySelector('#studentClassicRecall').textContent    = classic ? classic.recall.toFixed(2) : '--';
  root.querySelector('#studentClassicBest').textContent      = state.classic.saved
    ? `Saved: F1 ${state.classic.saved.f1.toFixed(2)}, ${state.classic.saved.method}, patch ${state.classic.saved.caseId || 'open'}, sigma ${state.classic.saved.sigma.toFixed(1)}, window ${state.classic.saved.windowPx}px, min ${state.classic.saved.minHeight.toFixed(1)}m.`
    : 'Saved result: none yet.';

  // Task 3 — with auto DL error hint (v2 addition)
  const model = MODEL_OPTIONS[state.dl.model] || MODEL_OPTIONS.mrcnn;
  const layer = a[model.asset];
  root.querySelector('#studentDlF1').textContent        = metricVal(layer, 'f1');
  root.querySelector('#studentDlIou').textContent       = metricVal(layer, 'mean_iou_matched');
  root.querySelector('#studentDlObjects').textContent   = String(layer.objects.length);
  root.querySelector('#studentDlReference').textContent = String(a.refs.features.filter(f => f.eval_keep).length);
  root.querySelector('#studentDlHint').innerHTML        = dlErrorHint(layer, model.label);

  // Task 4 — distance in px AND metres (v2 addition)
  const sam = samQuality(state.sam);
  root.querySelector('#studentSamDistance').textContent = sam.distanceText;
  root.querySelector('#studentSamQuality').textContent  = sam.label;
  root.querySelector('#studentSamScore').textContent    = state.sam.object && Number.isFinite(state.sam.object.score) ? state.sam.object.score.toFixed(2) : '--';
  root.querySelector('#studentSamDecision').textContent = state.sam.decision;
}

/* ── report generation ────────────────────────────────────── */

function updateReport(root, state){
  const report = root.querySelector('#studentReport');
  if(!report || !state.assets) return;
  const apex    = matchApexes(state.studentMarks, activeApexRefs(state.assets), MATCH_TOL_PX);
  const classic = state.classic.saved || state.classic.latest;
  const model   = MODEL_OPTIONS[state.dl.model] || MODEL_OPTIONS.mrcnn;
  const layer   = state.assets[model.asset];
  const sam     = samQuality(state.sam);
  const markList = state.studentMarks.length
    ? state.studentMarks.map((p,i)=>`${i+1}:(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(' ')
    : 'none';
  const lines = [
    'TreeSeg Lab Student Report',
    '',
    `1. Apex marking: ${state.studentMarks.length} marks; precision ${apex.precision.toFixed(2)}, recall ${apex.recall.toFixed(2)}, F1 ${apex.f1.toFixed(2)}.`,
    `   Marks: ${markList}`,
    `   Note: ${field(root,'#studentApexNote') || '(no note yet)'}`,
    '',
    classic
      ? `2. Classical tuning: ${classic.method}; patch "${classic.caseId||'open'}"; sigma ${classic.sigma.toFixed(1)}, window ${classic.windowPx}px, min ${classic.minHeight.toFixed(1)}m; F1 ${classic.f1.toFixed(2)} with ${classic.tops} treetops.`
      : '2. Classical tuning: no result yet.',
    `   Note: ${field(root,'#studentClassicNote') || '(no note yet)'}`,
    '',
    `3. DL comparison: ${model.label}; F1 ${metricVal(layer,'f1')}, mean IoU ${metricVal(layer,'mean_iou_matched')}; tagged: ${Array.from(state.dl.errors).join(', ')||'none'}.`,
    `   Note: ${field(root,'#studentDlNote') || '(no note yet)'}`,
    '',
    `4. SAM prompt: distance ${sam.distanceText}; quality ${sam.label}; decision ${state.sam.decision}.`,
    `   Note: ${field(root,'#studentSamNote') || '(no note yet)'}`,
    '',
    `Layers at report time: student marks ${onOff(state.layers.studentMarks)}, model ${onOff(state.layers.modelOutput)}, ref crowns ${onOff(state.layers.referenceCrowns)}, ref apexes ${onOff(state.layers.referenceApexes)}.`,
    '',
    'Reflection: How did the definition of "tree" change from CHM peak, to rule-based region, to learned mask, to prompt-assisted segmentation?'
  ];
  report.value = lines.join('\n');
}

/* ── utility functions ────────────────────────────────────── */

function activeApexRefs(assets){ return assets.apex.features.filter(f => f.eval_keep); }

function metricVal(layer, key){
  const v = layer?.metrics?.[key];
  return Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '--';
}

/**
 * Auto-generate an error hint for Task 3 based on actual TP/FP/FN.
 * This gives students data-grounded feedback, not just a label to tick.
 */
function dlErrorHint(layer, modelLabel){
  const m = layer?.metrics;
  if(!m) return 'Select a model to see error analysis.';
  const {tp, fp, fn, f1} = m;
  let dominant, advice;
  if(fn > fp * 1.5){
    dominant = `Omission dominates (FN=${fn} >> FP=${fp})`;
    advice   = `${modelLabel} misses many reference crowns — check for missed small and dense crowns.`;
  }else if(fp > fn * 1.5){
    dominant = `Commission dominates (FP=${fp} >> FN=${fn})`;
    advice   = `${modelLabel} creates excess false predictions — check for split crowns or background detections.`;
  }else{
    dominant = `Balanced errors (FP=${fp}, FN=${fn})`;
    advice   = `Neither omission nor commission clearly dominates at this scale.`;
  }
  return `<b>${dominant}</b> · ${advice} Overall F1=${Number(f1).toFixed(3)}, TP=${tp}.`;
}

/**
 * SAM prompt quality with dual-unit distance (px and metres).
 */
function samQuality(sam){
  if(!sam.prompt || !sam.object) return {label:'no prompt', distanceText:'--'};
  const d   = sam.object.promptDistancePx;
  const dm  = (d * PX_TO_M).toFixed(1);
  const txt = `${d.toFixed(1)} px · ${dm} m`;
  if(d <= 8)  return {label:'strong prompt (≤1.2 m)',  distanceText: txt};
  if(d <= 18) return {label:'usable prompt (≤2.7 m)',  distanceText: txt};
  return         {label:'risky prompt (>2.7 m)',        distanceText: txt};
}

function nearestSamObject(objects, p){
  let best = null, bd = Infinity;
  for(const obj of objects || []){
    const q = obj.prompt_point_px || obj.centroid_px;
    const d = (p.x - q[0]) ** 2 + (p.y - q[1]) ** 2;
    if(d < bd){ bd = d; best = obj; }
  }
  return best ? {...best, promptDistancePx: Math.sqrt(bd)} : null;
}

function canvasPoint(canvas, event){
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width)  * canvas.width,
    y: ((event.clientY - rect.top)  / rect.height) * canvas.height
  };
}

function drawStudentMarks(ctx, marks, details){
  ctx.save();
  marks.forEach((p, i) => {
    const st    = details ? details.pointStatus[i] : 'pending';
    const color = st === 'matched' ? '#54b99a' : '#c95f27';
    ctx.strokeStyle = 'rgba(6,18,16,.92)'; ctx.lineWidth = 4; drawCross(ctx, p.x, p.y, 7);
    ctx.strokeStyle = color;               ctx.lineWidth = 2; drawCross(ctx, p.x, p.y, 7);
  });
  ctx.restore();
}

function drawCross(ctx, x, y, r){
  ctx.beginPath();
  ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
  ctx.stroke();
}

function drawPromptPoint(ctx, p, color, r){
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = 'rgba(6,18,16,.92)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function legendForTask(task, state){
  const refCrown = state.layers.referenceCrowns ? '<span><i class="swatch" style="background:#f4f8f5"></i>Reference crown</span>' : '';
  const refApex  = state.layers.referenceApexes ? '<span><i class="swatch" style="background:#f0da70"></i>Reference apex</span>' : '';
  if(task === 'classical') return `${state.layers.modelOutput ? '<span><i class="swatch" style="background:#1f7bcd"></i>Algorithm boundary</span><span><i class="swatch" style="background:#f0da70"></i>Detected treetop</span>' : ''}${refCrown}${refApex}`;
  if(task === 'dl')        return `${state.layers.modelOutput ? '<span><i class="swatch" style="background:#2d6485"></i>Selected model output</span>' : ''}${refCrown}${refApex}`;
  if(task === 'sam')       return `${state.layers.studentMarks ? '<span><i class="swatch" style="background:#2d6485"></i>Your prompt</span>' : ''}${state.layers.modelOutput ? '<span><i class="swatch" style="background:#b07b22"></i>Nearest SAM mask</span>' : ''}${refCrown}${refApex}`;
  return `${state.layers.studentMarks ? '<span><i class="swatch" style="background:#54b99a"></i>Student mark</span>' : ''}${state.layers.modelOutput && task === 'report' ? '<span><i class="swatch" style="background:#2d6485"></i>Model output</span>' : ''}${refCrown}${refApex}`;
}

function field(root, sel){ const el = root.querySelector(sel); return el ? el.value.trim() : ''; }
function onOff(v){ return v ? 'shown' : 'hidden'; }
