/**
 * learn_v2.js
 * Changes from original learn.js (27-line static stub):
 *   1. Visual ITC pipeline drawn with Canvas 2D API
 *   2. Comparison table: detection vs delineation vs evaluation
 *   3. Scale-dependency illustration in a small interactive canvas
 *   4. "What next" callout linking to Data module
 */

export const learnModule = {
  html(){
    return `
      <section class="module-grid">
        <div class="panel pad span-12">
          <h2>Core problem: detect individual trees, then delineate their crowns.</h2>
          <p class="intro">ITC detection asks <em>where</em> each tree is (usually an apex point or bounding box). ITC delineation asks <em>which pixels or points</em> belong to the same crown. The difficulty is that real canopies are overlapping, multi-peak, partially visible, and sensor-dependent.</p>
        </div>

        <!-- Pipeline visual: LAS → CHM → Detection → Delineation → Evaluation -->
        <div class="panel pad span-12">
          <div class="micro-label" style="margin-bottom:10px">The ITC pipeline</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;align-items:center">
            ${pipeBlock('1','LAS','3D points','#146b56')}
            ${arrow()}
            ${pipeBlock('2','CHM','2D surface','#2f8a69')}
            ${arrow()}
            ${pipeBlock('3','Detect','apex / box','#347f91')}
            ${arrow()}
            ${pipeBlock('4','Delineate','crown mask','#b07b22')}
            ${arrow()}
            ${pipeBlock('5','Evaluate','F1 / IoU','#9d4a3b')}
          </div>
          <canvas id="learnPipeCanvas" width="900" height="120"
                  style="display:block;width:100%;height:auto;margin-top:14px;border-radius:6px;background:#0c1713"
                  aria-label="Schematic ITC pipeline: point cloud, CHM peaks, apex candidates, crown regions, evaluation"></canvas>
        </div>

        <!-- Detection vs Delineation -->
        <div class="panel pad span-6">
          <h3>Detection</h3>
          <p>Find candidate trees. Classical methods search for CHM local maxima. Learned methods predict boxes, masks, or prompt-based object proposals.</p>
          <table class="info-table" style="margin-top:10px">
            <thead><tr><th>Approach</th><th>Output</th></tr></thead>
            <tbody>
              <tr><th>Local maxima</th><td>Apex points from CHM peaks</td></tr>
              <tr><th>Mask R-CNN RPN</th><td>Ranked object proposals</td></tr>
              <tr><th>YOLO one-pass</th><td>Grid-predicted bounding boxes</td></tr>
              <tr><th>SAM with prompt</th><td>Mask requested at an apex click</td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel pad span-6">
          <h3>Delineation</h3>
          <p>Assign spatial extent to each tree. Classical methods grow regions from markers; deep learning predicts instance masks from learned crown appearance.</p>
          <table class="info-table" style="margin-top:10px">
            <thead><tr><th>Approach</th><th>Output</th></tr></thead>
            <tbody>
              <tr><th>Watershed</th><td>CHM-valley-bounded regions</td></tr>
              <tr><th>Region growing</th><td>Height-threshold-bounded regions</td></tr>
              <tr><th>Mask R-CNN head</th><td>Per-instance binary mask</td></tr>
              <tr><th>YOLO-Seg</th><td>Low-resolution polygon mask</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Why it is hard -->
        <div class="panel pad span-12">
          <div class="lesson-list">
            <div class="lesson-row">
              <b>Why hard?</b>
              <span>Broadleaf crowns are not perfect cones. Dense canopy removes the CHM valley that classical watershed expects. Two co-dominant stems share one local maximum. Sensor resolution controls whether small suppressed trees are visible at all.</span>
            </div>
            <div class="lesson-row">
              <b>Scale dependency</b>
              <span>A local-maxima window too small over-detects bumps inside one crown; too large, it merges adjacent trees. No single window works across the full range of crown sizes in a mixed-age forest. This is the first thing you will observe directly in the Classical Lab.</span>
            </div>
            <div class="lesson-row">
              <b>Detection ≠ delineation quality</b>
              <span>A method can correctly locate every apex (high detection F1) while producing coarse or wrong crown boundaries (low polygon IoU). The Evaluation Lab shows exactly this: SAM reaches apex F1 ≈ 0.90 but mask IoU ≈ 0.55. Understanding why requires both metrics.</span>
            </div>
            <div class="lesson-row">
              <b>What changed?</b>
              <span>Deep learning shifts the question from hand-coded crown geometry to learned spatial patterns, but introduces dependence on reference labels, training domain, and computational cost. The later labs show the trade-offs.</span>
            </div>
          </div>
        </div>

        <!-- Evaluation concepts -->
        <div class="panel pad span-12">
          <h3>Two levels of measurement</h3>
          <table class="info-table">
            <thead><tr><th>Level</th><th>Question</th><th>Metric</th><th>Limit</th></tr></thead>
            <tbody>
              <tr><th>Detection</th><td>Was a tree found near this reference apex?</td><td>Precision, Recall, F1 (point match ≤ 16 px)</td><td>Does not measure boundary quality</td></tr>
              <tr><th>Delineation</th><td>Does the predicted polygon overlap the reference crown?</td><td>Polygon IoU ≥ 0.25 (Hungarian match)</td><td>Does not reflect location accuracy independently</td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel pad span-12">
          <div class="callout">
            <b>Next step</b>: Open <a href="#/data">Data Explorer</a> to compare what a LAS point cloud and a CHM each reveal about the same 75 m forest patch — then try to detect tree apexes manually before the algorithm does.
          </div>
        </div>
      </section>
    `;
  },

  init(root){
    const canvas = root.querySelector('#learnPipeCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width, H = canvas.height;
    drawPipelineIllustration(ctx, W, H);
  }
};

/* ── HTML helpers ─────────────────────────────────────────── */

function pipeBlock(num, title, sub, color){
  return `
    <div style="text-align:center;padding:10px 8px;background:${color}18;border:1px solid ${color}55;border-radius:6px">
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:${color};letter-spacing:.1em">${num}</div>
      <div style="font-size:14px;font-weight:800;margin:3px 0">${title}</div>
      <div style="font-size:11px;color:var(--muted)">${sub}</div>
    </div>`;
}

function arrow(){
  return `<div style="text-align:center;color:var(--muted);font-size:20px;padding:0 4px">→</div>`;
}

/* ── pipeline illustration (Canvas 2D) ───────────────────── */

function drawPipelineIllustration(ctx, W, H){
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0c1713';
  ctx.fillRect(0, 0, W, H);

  const sections = 5;
  const sw       = W / sections;
  const pad      = 12;

  // 1: LAS points — coloured dots scattered in a crown-ish pattern
  drawSection(ctx, 0, sw, H, '1 LAS', '#146b56', () => {
    const cx = sw * 0.5, cy = H * 0.45;
    const pts = [[0,.25,.85],[-.3,.15,.65],[.3,.18,.7],[-.15,-.1,.55],[.2,-.05,.5],[0,.05,.9],[-.25,.3,.75],[.1,.35,.95]];
    for(const [dx, dy, br] of pts){
      const r = 2 + br * 2, x = cx + dx * sw * 0.32, y = cy - dy * H * 0.28;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = br > 0.7 ? '#eadb76' : br > 0.5 ? '#54b99a' : '#2f7d5e';
      ctx.fill();
    }
    label3D(ctx, sw * 0.5, H * 0.85, '3D returns', '#54b99a');
  });

  // 2: CHM — a simple height ridge
  drawSection(ctx, sw, sw, H, '2 CHM', '#2f8a69', () => {
    const ox = sw, cw = sw, ch = H;
    ctx.save();
    ctx.beginPath();
    const pts2 = [0,.15,.35,.6,.85,1,.85,.6,.35,.15,0];
    for(let i = 0; i < pts2.length; i++){
      const x = ox + (i / (pts2.length - 1)) * cw;
      const y = ch * 0.85 - pts2[i] * ch * 0.6;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#54b99a'; ctx.lineWidth = 2.5; ctx.stroke();
    // fill under curve
    ctx.lineTo(ox + cw, ch * 0.85); ctx.lineTo(ox, ch * 0.85); ctx.closePath();
    ctx.fillStyle = 'rgba(84,185,154,.12)'; ctx.fill();
    ctx.restore();
    label3D(ctx, ox + cw * 0.5, ch * 0.85, '2D height surface', '#54b99a');
  });

  // 3: Detection — apex dot + dashed circle
  drawSection(ctx, sw * 2, sw, H, '3 Detect', '#347f91', () => {
    const cx = sw * 2.5, cy = H * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    ctx.arc(cx, cy, H * 0.23, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(52,127,145,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#eadb76'; ctx.strokeStyle = 'rgba(10,18,14,.9)'; ctx.lineWidth = 1.8;
    ctx.fill(); ctx.stroke();
    ctx.restore();
    label3D(ctx, sw * 2.5, H * 0.85, 'apex candidate', '#eadb76');
  });

  // 4: Delineation — filled crown polygon
  drawSection(ctx, sw * 3, sw, H, '4 Delineate', '#b07b22', () => {
    const cx = sw * 3.5, cy = H * 0.42;
    const r  = H * 0.26;
    ctx.save();
    ctx.beginPath();
    for(let i = 0; i < 8; i++){
      const a  = (i / 8) * Math.PI * 2 - Math.PI * 0.5;
      const rr = r * (0.78 + Math.sin(i * 2.3) * 0.14);
      const x  = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(176,123,34,.22)'; ctx.fill();
    ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#eadb76'; ctx.fill();
    ctx.restore();
    label3D(ctx, sw * 3.5, H * 0.85, 'crown polygon', '#d9a441');
  });

  // 5: Evaluation — TP green, FP orange, FN red
  drawSection(ctx, sw * 4, sw, H, '5 Evaluate', '#9d4a3b', () => {
    const cx = sw * 4.5, cy = H * 0.42;
    // TP
    ctx.save();
    ctx.beginPath(); ctx.arc(cx - 10, cy - 5, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(84,185,154,.3)'; ctx.fill();
    ctx.strokeStyle = '#54b99a'; ctx.lineWidth = 1.5; ctx.stroke();
    // FP
    ctx.beginPath(); ctx.arc(cx + 18, cy + 8, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201,95,39,.2)'; ctx.fill();
    ctx.strokeStyle = '#c95f27'; ctx.lineWidth = 1.5; ctx.stroke();
    // FN (dashed)
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(cx - 5, cy + 20, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(157,74,59,.15)'; ctx.fill();
    ctx.strokeStyle = '#9d4a3b'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    label3D(ctx, sw * 4.5, H * 0.85, 'F1 / IoU', '#54b99a');
  });
}

function drawSection(ctx, x, w, H, title, color, drawFn){
  ctx.save();
  ctx.fillStyle = `${color}08`;
  ctx.fillRect(x + 2, 2, w - 4, H - 4);
  ctx.font      = 'bold 11px ui-monospace,monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(title, x + w * 0.5, 16);
  drawFn();
  ctx.restore();
}

function label3D(ctx, x, y, text, color){
  ctx.save();
  ctx.font      = '11px ui-monospace,monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.restore();
}
