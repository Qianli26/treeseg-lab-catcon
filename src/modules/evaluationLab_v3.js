/**
 * evaluationLab_v3.js  (Module 07)
 * Change from v2: student apex marking completely removed.
 * Rationale: Task 1 (apex marking) belongs to Student Workbook (08).
 * By the time students reach 07 they have not yet marked anything,
 * so the section was always blank and confused the layout.
 * 07 is now a pure model-output comparison and analysis page.
 */

import {loadModelAssets} from '../assets.js';
import {
  drawApexes, drawChm, drawMethodObjects, drawReferenceCrowns
} from '../draw.js';

/* ── helpers ─────────────────────────────────────────────── */

function mv(m, key){
  const v = m?.metrics?.[key];
  return Number.isFinite(Number(v)) ? Number(v) : null;
}
function fmt(v, d = 3){ return v != null ? v.toFixed(d) : '—'; }
function prevFmt(m, key){
  const v = m?.previous_metrics?.[key];
  return Number.isFinite(Number(v)) ? Number(v).toFixed(3) : null;
}

const MODELS = [
  {key:'mrcnn',   label:'Mask R-CNN M1',  dot:'#2d6485'},
  {key:'yoloSeg', label:'YOLO-Seg',       dot:'#347f91'},
  {key:'samApex', label:'SAM apex masks', dot:'#b07b22'},
  {key:'yoloDet', label:'YOLO boxes',     dot:'#c95f27'},
];

/* ── module ──────────────────────────────────────────────── */

export const evaluationLabModule = {
  html(){
    return `
      <section class="module-grid">
        <div class="panel pad span-12">
          <h2>Same CHM, same reference, different model outputs.</h2>
          <p class="intro">Compare Mask R-CNN, YOLO-Seg, SAM-assisted masks, and YOLO detection boxes against 446 manually verified reference crowns — all on the same 75 m airborne LiDAR subset.</p>
        </div>

        <!-- Context banner: explains the F1 drop vs published paper -->
        <div class="panel pad span-12">
          <div class="callout">
            <b>Why are the scores lower than the published paper?</b><br>
            The paper reports Mask R-CNN F1 = 0.803 on a full 1 059-crown test set.
            This teaching crop uses a <b>manually QA'd reference of 446 complete crowns</b>
            — expanded from the initial 260-crown clip, adding many small and
            densely packed crowns the model did not see during training.
            Predictions were <b>not retrained</b> on the updated reference, so recall falls
            significantly while precision stays near 0.80.
            Grey subscript scores below are from the old 260-crown clip.
            SAM-assisted masks reach F1 ≈ 0.90 using expert apex prompts — a
            human-in-the-loop result, not fully automatic detection.
          </div>
        </div>

        <!-- Canvas + slim toolbar -->
        <div class="panel pad span-12">
          <div class="lab-layout">

            <!-- left: evaluation canvas -->
            <div>
              <div class="viewer">
                <div class="viewer-head">
                  <span class="viewer-title">Airborne CHM · 75 m teaching subset</span>
                  <span class="chip">model evaluation</span>
                </div>
                <canvas id="evalRealCanvas" width="500" height="500"
                        aria-label="Real CHM with model overlays and reference crowns"></canvas>
              </div>
              <div class="legend" style="margin-top:14px">
                ${MODELS.map(m=>`<span><i class="swatch" style="background:${m.dot}"></i>${m.label}</span>`).join('')}
                <span><i class="swatch" style="background:#f4f8f5;border:1px solid #c8d8c8"></i>Reference crowns</span>
                <span><i class="swatch" style="background:#54b99a;border-radius:50%"></i>Reference apexes</span>
              </div>
            </div>

            <!-- right: slim toolbar — layers + reference set info only -->
            <aside class="eval-toolbar-slim">
              <div class="status" id="evalStatus">Loading model outputs…</div>

              <div class="control-group">
                <div class="control-title">Visible layers</div>
                <label class="check"><input type="checkbox" id="evalShowRef"     checked>Reference crowns</label>
                <label class="check"><input type="checkbox" id="evalShowApex"    checked>Reference apexes</label>
                <label class="check"><input type="checkbox" id="evalShowMrcnn"   checked>Mask R-CNN M1</label>
                <label class="check"><input type="checkbox" id="evalShowYoloSeg" checked>YOLO-Seg masks</label>
                <label class="check"><input type="checkbox" id="evalShowSam"     checked>SAM apex masks</label>
                <label class="check"><input type="checkbox" id="evalShowYoloDet">YOLO boxes</label>
              </div>

              <div class="control-group">
                <div class="control-title">Reference set</div>
                <div class="metric-grid">
                  <div class="metric">
                    <div class="metric-key">Eval Crowns</div>
                    <div class="metric-val" id="evalCrownN">—</div>
                  </div>
                  <div class="metric">
                    <div class="metric-key">Eval Apexes</div>
                    <div class="metric-val" id="evalApexN">—</div>
                  </div>
                </div>
              </div>

              <div class="callout" style="font-size:13px;line-height:1.6">
                <b>Student apex marking</b> is in
                <a href="#/student" style="color:var(--green);font-weight:700">Student Workbook → Task 1</a>.<br>
                Go there to place marks and see your F1 scored against these 446 reference apexes.
              </div>
            </aside>
          </div>
        </div>

        <!-- Model comparison summary table -->
        <div class="panel pad span-12">
          <h3>Model performance at a glance</h3>
          <p class="card-body" style="margin-bottom:14px">
            Crown polygon IoU ≥ 0.25 · 446 evaluated crowns.
            <span style="color:var(--muted)">Grey subscript = previous score against the old 260-crown clip.</span>
          </p>
          <table class="eval-summary-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>F1</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>Mean IoU<br><span style="font-weight:400;font-size:11px">(matched pairs)</span></th>
                <th>Predictions</th>
              </tr>
            </thead>
            <tbody id="evalSummaryBody">
              <tr><td colspan="6" style="color:var(--muted)">Loading…</td></tr>
            </tbody>
          </table>
        </div>

        <!-- TP / FP / FN error breakdown -->
        <div class="panel pad span-12">
          <h3>Error breakdown by model</h3>
          <p class="card-body" style="margin-bottom:12px">
            <span style="color:#1a5c42;font-weight:700">TP</span> = correctly matched crown ·
            <span style="color:#c95f27;font-weight:700">FP</span> = commission error (false detection) ·
            <span style="color:#9d4a3b;font-weight:700">FN</span> = omission error (missed crown)
          </p>
          <table class="info-table">
            <thead>
              <tr><th>Metric</th><th>Mask R-CNN</th><th>YOLO-Seg</th><th>SAM</th><th>YOLO boxes</th></tr>
            </thead>
            <tbody id="evalErrorBody">
              <tr><td colspan="5" style="color:var(--muted)">Loading…</td></tr>
            </tbody>
          </table>
        </div>

        <!-- How to read -->
        <div class="panel pad span-12">
          <h3>How to read the scores</h3>
          <div class="lesson-list">
            <div class="lesson-row">
              <b>Detection vs delineation</b>
              <span>Apex point-matching tells you whether a tree was <em>located</em>. Polygon IoU tells you how well its boundary was <em>traced</em>. A model can succeed at one and fail at the other.</span>
            </div>
            <div class="lesson-row">
              <b>Reference expansion effect</b>
              <span>Adding 186 new crowns (260 → 446) introduces mostly small and densely packed trees the model missed. Recall drops sharply; precision stays near 0.80. This illustrates how benchmark design controls reported accuracy.</span>
            </div>
            <div class="lesson-row">
              <b>SAM advantage explained</b>
              <span>SAM reaches F1 ≈ 0.90 because it receives expert-verified apex points as foreground prompts — one per crown. This is human-in-the-loop delineation: the human locates the tree, SAM traces the boundary.</span>
            </div>
            <div class="lesson-row">
              <b>Next step</b>
              <span>Open <a href="#/student" style="color:var(--green);font-weight:700">Student Workbook</a> to mark your own apexes (Task 1), tune a classical method (Task 2), and compare with these outputs (Task 3).</span>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  async init(root){
    const abort  = new AbortController();
    const canvas = root.querySelector('#evalRealCanvas');
    const ctx    = canvas.getContext('2d');
    const status = root.querySelector('#evalStatus');
    let state    = {assets: null};

    const setStatus = (kind, text) => {
      status.className   = `status ${kind || ''}`;
      status.textContent = text;
    };

    const checked = id => root.querySelector(id).checked;

    const render = () => {
      const a = state.assets;
      drawChm(ctx, a.chmImage);
      if(checked('#evalShowMrcnn'))   drawMethodObjects(ctx, a.mrcnn.objects,  'rgba(45,100,133,.88)', 'rgba(45,100,133,.09)', {lineWidth:1.4});
      if(checked('#evalShowYoloSeg')) drawMethodObjects(ctx, a.yoloSeg.objects,'rgba(52,127,145,.88)', 'rgba(52,127,145,.15)', {lineWidth:1.2});
      if(checked('#evalShowSam'))     drawMethodObjects(ctx, a.samApex.objects,'rgba(176,123,34,.92)', 'rgba(235,219,118,.13)',{lineWidth:1.25});
      if(checked('#evalShowYoloDet')) drawMethodObjects(ctx, a.yoloDet.objects,'rgba(201,95,39,.92)',  'rgba(201,95,39,.035)', {lineWidth:1.35, boxes:true});
      drawReferenceCrowns(ctx, a.refs, {show:checked('#evalShowRef'), showEdge:true});
      drawApexes(ctx, a.apex, {show:checked('#evalShowApex')});
    };

    const populateMetrics = (a) => {
      /* summary table */
      root.querySelector('#evalSummaryBody').innerHTML = MODELS.map(({key, label, dot}) => {
        const m   = a[key];
        const f1  = mv(m, 'f1');
        const pf1 = prevFmt(m, 'f1');
        return `<tr>
          <td class="model-name">
            <i class="eval-model-dot" style="background:${dot}"></i>${label}
          </td>
          <td>
            <span class="f1-val">${fmt(f1)}</span>
            ${pf1 ? `<span class="prev-score">prev 260-ref: ${pf1}</span>` : ''}
          </td>
          <td>${fmt(mv(m,'precision'))}</td>
          <td>${fmt(mv(m,'recall'))}</td>
          <td>${fmt(mv(m,'mean_iou_matched'))}</td>
          <td>${m?.objects?.length ?? '—'}</td>
        </tr>`;
      }).join('');

      /* error table */
      const models = [a.mrcnn, a.yoloSeg, a.samApex, a.yoloDet];
      const eRow = (label, key, cls) =>
        `<tr><td>${label}</td>${models.map(m=>`<td class="${cls}">${m?.metrics?.[key] ?? '—'}</td>`).join('')}</tr>`;
      root.querySelector('#evalErrorBody').innerHTML =
        eRow('TP (matched crown)',    'tp', 'error-val-tp') +
        eRow('FP (commission error)', 'fp', 'error-val-fp') +
        eRow('FN (omission error)',   'fn', 'error-val-fn') +
        eRow('Precision',             'precision', '') +
        eRow('Recall',                'recall',    '') +
        eRow('F1',                    'f1',        '') +
        eRow('Mean IoU (matched)',    'mean_iou_matched', '');

      /* reference counts */
      root.querySelector('#evalCrownN').textContent = a.refs.features.filter(f=>f.eval_keep).length;
      root.querySelector('#evalApexN').textContent  = a.apex.features.filter(f=>f.eval_keep).length;
    };

    try{
      state.assets = await loadModelAssets();
      const a = state.assets;
      setStatus('ready',
        `${a.refs.summary.display_count} crowns · ${a.apex.summary.eval_count} eval apexes · ` +
        `${a.mrcnn.objects.length} MRCNN · ${a.yoloSeg.objects.length} YOLO-Seg · ` +
        `${a.samApex.objects.length} SAM · ${a.yoloDet.objects.length} YOLO-Det`);
      populateMetrics(a);
      render();
    }catch(err){
      setStatus('warn', err.message);
      return () => abort.abort();
    }

    root.querySelectorAll('input[type="checkbox"]').forEach(el =>
      el.addEventListener('change', render, {signal: abort.signal}));

    return () => abort.abort();
  }
};
