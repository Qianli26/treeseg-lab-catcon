export const dlLabModule = {
  html(){
    return `
      <section class="module-grid">
        <div class="panel pad span-12">
          <div class="chip" style="display:inline-block;margin-bottom:12px;color:#8a5b0e;border:1px solid #d9b36f;border-radius:999px;padding:6px 10px;background:#fff8e8">Illustrative · concept only</div>
          <h2>A different way to pose the same question.</h2>
          <p class="intro">The wall in classical ITC is geometric: no valley, no split. Deep learning does not tune its way around that question. It changes the question from <span class="term">where are the valleys?</span> to <span class="term">what does a crown look like?</span> These panels teach the mechanism behind three strategies before students evaluate their real outputs.</p>
        </div>

        <div class="dl-concept-grid span-12">
          ${conceptCard('Mask R-CNN','propose -> refine · per-instance','conceptMask','First proposes regions where trees might exist, then refines each proposal into a box and mask. It can separate touching crowns because each crown becomes its own instance hypothesis.','mask')}
          ${conceptCard('YOLO / YOLO-Seg','grid regression · one pass','conceptYolo','Predicts many trees in a single forward pass. YOLO detects boxes quickly; YOLO-Seg adds a mask head, trading speed and scale for boundary coarseness in dense crowns.','yolo')}
          ${conceptCard('SAM-assisted','promptable · general','conceptSam','A prompt such as an apex point or box asks a general segmentation model for a mask. It is powerful for human-in-the-loop ITC, but it is not tree-specific without prompts and filtering.','sam')}
        </div>

        <div class="panel pad span-12">
          <h3>Mechanism shift</h3>
          <table class="info-table">
            <thead><tr><th>Method family</th><th>What it asks</th><th>Typical output</th><th>Teaching point</th></tr></thead>
            <tbody>
              <tr><th>Classical rules</th><td>Where are CHM peaks and valleys?</td><td>Treetop points + grown regions</td><td>Interpretable, but tied to windows, seeds, and canopy valleys.</td></tr>
              <tr><th>Mask R-CNN</th><td>Which proposals contain individual crowns?</td><td>Boxes + per-instance masks</td><td>Separates objects by learned appearance, not only CHM drainage geometry.</td></tr>
              <tr><th>YOLO / YOLO-Seg</th><td>Where are all crown objects in one pass?</td><td>Fast boxes or masks</td><td>Scales well, but small dense crowns and coarse masks remain difficult.</td></tr>
              <tr><th>SAM-assisted</th><td>Given this prompt, what object mask fits?</td><td>Prompted masks</td><td>Moves ITC toward expert-guided, human-AI delineation workflows.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel pad span-12">
          <h3>Bridge to evaluation</h3>
          <p class="intro">The mechanisms here are conceptual. Open <a href="#/evaluation">Evaluation Lab</a> to see the same method families as real overlays on the airborne CHM, with F1 and mean IoU computed against the checked reference crowns.</p>
        </div>
      </section>
    `;
  },
  init(root){
    const abort = new AbortController();
    const frames = [];
    const start = (key)=>{
      const canvas = root.querySelector(`[data-concept="${key}"]`);
      if(!canvas) return;
      const existing = frames.find(f=>f.canvas===canvas);
      if(existing) cancelAnimationFrame(existing.raf);
      const frame = {canvas, raf:null, tick:0};
      frames.push(frame);
      const ctx = canvas.getContext('2d');
      const draw = () => {
        frame.tick += 1;
        if(key === 'mask') drawMaskRcnn(ctx, frame.tick);
        if(key === 'yolo') drawYolo(ctx, frame.tick);
        if(key === 'sam') drawSam(ctx, frame.tick);
        frame.raf = requestAnimationFrame(draw);
      };
      draw();
    };
    ['mask','yolo','sam'].forEach(start);
    root.querySelectorAll('[data-replay]').forEach(button=>{
      button.addEventListener('click', ()=>start(button.dataset.replay), {signal:abort.signal});
    });
    return () => {
      abort.abort();
      frames.forEach(f=>cancelAnimationFrame(f.raf));
    };
  }
};

function conceptCard(title, strategy, canvasId, body, key){
  return `
    <article class="panel dl-card">
      <div class="dl-card-head">
        <h3>${title}</h3>
        <span class="chip concept-chip">Concept</span>
      </div>
      <div class="micro-label" style="color:#8a5b0e;margin-bottom:10px">${strategy}</div>
      <canvas id="${canvasId}" data-concept="${key}" width="360" height="210" aria-label="${title} mechanism animation"></canvas>
      <p>${body}</p>
      <button class="btn" data-replay="${key}">Replay</button>
    </article>
  `;
}

function reset(ctx){
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.fillStyle = '#08120f';
  ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
}

function label(ctx, text){
  ctx.fillStyle = '#a8b7ae';
  ctx.font = '12px ui-monospace,monospace';
  ctx.fillText(text, 14, ctx.canvas.height - 14);
}

function drawCrown(ctx, x, y, r, fill='rgba(28,92,64,.48)'){
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fill();
}

function drawMaskRcnn(ctx, tick){
  reset(ctx);
  const crowns = [[92,116,34],[178,92,40],[262,124,35]];
  crowns.forEach(c=>drawCrown(ctx, ...c));
  const t = tick % 210;
  if(t < 70){
    ctx.strokeStyle = '#b07b22';
    ctx.lineWidth = 2;
    ctx.setLineDash([5,4]);
    crowns.forEach((c,i)=>{
      if(t > i*12){
        const s = Math.min(1,(t-i*12)/24);
        const r = c[2] * 1.35 * s;
        ctx.strokeRect(c[0]-r,c[1]-r,r*2,r*2);
      }
    });
    ctx.setLineDash([]);
    label(ctx, '1 propose candidate crown regions');
  }else if(t < 140){
    ctx.strokeStyle = '#b07b22';
    ctx.lineWidth = 2;
    crowns.forEach(c=>ctx.strokeRect(c[0]-c[2]*1.35,c[1]-c[2]*1.35,c[2]*2.7,c[2]*2.7));
    label(ctx, '2 align and refine each region');
  }else{
    const s = Math.min(1,(t-140)/38);
    crowns.forEach((c,i)=>{
      const colors = ['rgba(84,185,154,.72)','rgba(181,201,82,.68)','rgba(70,132,158,.68)'];
      drawCrown(ctx, c[0], c[1], c[2]*s, colors[i]);
    });
    label(ctx, '3 output per-instance masks');
  }
}

function drawYolo(ctx, tick){
  reset(ctx);
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.strokeStyle = 'rgba(176,123,34,.30)';
  ctx.lineWidth = 1;
  for(let i=1;i<6;i++){
    ctx.beginPath();
    ctx.moveTo(i*w/6,0); ctx.lineTo(i*w/6,h);
    ctx.moveTo(0,i*h/6); ctx.lineTo(w,i*h/6);
    ctx.stroke();
  }
  const crowns = [[96,88,13],[184,126,14],[252,78,16],[148,162,12]];
  crowns.forEach(c=>drawCrown(ctx, ...c, 'rgba(31,110,78,.72)'));
  const t = tick % 180;
  if(t < 70){
    label(ctx, '1 divide CHM into prediction grid');
    return;
  }
  const s = Math.min(1,(t-70)/26);
  ctx.strokeStyle = '#54b99a';
  ctx.lineWidth = 2.2;
  crowns.forEach(c=>{
    const r = c[2] * 1.7 * s;
    ctx.strokeRect(c[0]-r,c[1]-r,r*2,r*2);
  });
  if(t > 112){
    ctx.fillStyle = 'rgba(84,185,154,.38)';
    crowns.forEach(c=>{
      ctx.beginPath();
      ctx.arc(c[0],c[1],c[2]*1.2,0,Math.PI*2);
      ctx.fill();
    });
    label(ctx, '3 YOLO-Seg adds a mask head');
  }else{
    label(ctx, '2 predict all boxes in one pass');
  }
}

function drawSam(ctx, tick){
  reset(ctx);
  const t = tick % 170;
  drawCrown(ctx, 180,106,40,'rgba(60,145,104,.52)');
  const y = t < 42 ? 36 + t*1.7 : 106;
  ctx.fillStyle = '#b5c952';
  ctx.beginPath();
  ctx.arc(180, Math.min(y,106), 6, 0, Math.PI*2);
  ctx.fill();
  if(t < 42){
    label(ctx, '1 expert gives an apex prompt');
    return;
  }
  const s = Math.min(1,(t-42)/44);
  ctx.fillStyle = 'rgba(84,185,154,.70)';
  ctx.beginPath();
  ctx.arc(180,106,40*s,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#8fe3c1';
  ctx.lineWidth = 2;
  ctx.stroke();
  label(ctx, '2 prompt-conditioned mask proposal');
}
