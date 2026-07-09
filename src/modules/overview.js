export const overviewModule = {
  html(){
    return `
      <section class="module-grid dashboard-overview">
        <div class="panel pad span-12 dashboard-intro">
          <div>
            <div class="micro-label">Teaching software for ITC detection and delineation</div>
            <h2>From seeing tree crowns to explaining model decisions.</h2>
            <p class="intro">TreeSeg Lab is a static, open teaching workbench for learning individual tree crown detection and delineation with real LiDAR-derived data. Students move from forest evidence, to classical rules, to learned instance segmentation, then evaluate outputs against reference crowns and apexes.</p>
          </div>
          <div class="overview-summary" aria-label="Teaching summary">
            <div><b>Input</b><span>LAS sample, CHM, apex points, reference crowns</span></div>
            <div><b>Methods</b><span>Local maxima, watershed, region growing, Mask R-CNN, YOLO-Seg, SAM-assisted masks</span></div>
            <div><b>Output</b><span>Interactive interpretation, model comparison, student report</span></div>
          </div>
        </div>

        <div class="panel pad span-4 overview-panel">
          <div class="micro-label">Learning design</div>
          <h3>Students build the idea step by step.</h3>
          <p>They first define what counts as an individual tree, then inspect how 3D LiDAR evidence becomes a CHM, then test how rules and learned models interpret the same canopy.</p>
        </div>

        <div class="panel pad span-4 overview-panel">
          <div class="micro-label">Interaction</div>
          <h3>The lesson is driven by doing.</h3>
          <p>Students click crowns, toggle reference layers, tune classical parameters, compare DL overlays, mark their own apexes, and generate a short report from their choices.</p>
        </div>

        <div class="panel pad span-4 overview-panel">
          <div class="micro-label">CATCON fit</div>
          <h3>The package is portable and teachable.</h3>
          <p>The webapp runs as static files, uses precomputed assets for reliable teaching, and can be extended with UAV LiDAR or single-photon LiDAR as sensor-comparison modules.</p>
        </div>

        <div class="panel pad span-12">
          <div class="micro-label">Recommended classroom route</div>
          <div class="overview-route">
            <a href="#/learn"><b>Problem</b><span>What is ITC detection and delineation?</span></a>
            <a href="#/data"><b>Data</b><span>What do LAS and CHM each reveal?</span></a>
            <a href="#/classical"><b>Rules</b><span>When do local maxima and watershed fail?</span></a>
            <a href="#/dl"><b>Models</b><span>How do boxes, masks, and prompts change the workflow?</span></a>
            <a href="#/evaluation"><b>Evaluate</b><span>Why can F1 and IoU tell different stories?</span></a>
            <a href="#/student"><b>Apply</b><span>Can students explain their own decisions?</span></a>
          </div>
        </div>
      </section>
    `;
  }
};
