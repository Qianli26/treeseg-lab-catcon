# TreeSeg Lab — ITC Teaching Workbench

**CATCON 2026 Submission** · Computer Assisted Teaching Contest

A static, browser-based interactive teaching workbench for individual tree crown (ITC) detection and delineation from airborne LiDAR data. No installation, no server, no login required.

**Live demo → https://&lt;your-username&gt;.github.io/treeseg-lab-catcon/**

---

## What it teaches

Students move through a complete ITC pipeline:

| Module | Topic |
|--------|-------|
| 01 Overview | Teaching design and learning path |
| 02 Problem | ITC detection vs delineation concepts |
| 03 Data | LAS point cloud → CHM with linked 2D views |
| 04 Classical | Live local-maxima + watershed + region growing (real CHM) |
| 05 Features | Hand-crafted cues → learned CNN representations |
| 06 Deep Learning | Mask R-CNN, YOLO-Seg, SAM mechanism animations |
| 07 Evaluation | Real model outputs vs 446-crown reference, F1/IoU |
| 08 Student Workbook | 5 tasks: mark apexes, tune classical, compare DL, SAM prompts, report |
| 09 Instructor | Teaching checklist, dataset summary, copyable methods note |

## Data

75 m × 75 m airborne LiDAR teaching subset (EPSG:32616):

- CHM: 500 × 500 px at 0.15 m resolution
- LAS: 60,000 sampled points (from 256,724 in the crop)
- Reference: 446 manually verified complete crowns + 456 apex points
- Models: Mask R-CNN M1 (249 predictions), YOLO-Seg (202), SAM-assisted (446), YOLO-Det (212)

## Design principles

- **Honest boundary**: classical methods run live; DL outputs are precomputed and clearly labelled
- **No black box**: every F1 score is explained with TP/FP/FN and benchmark-design context
- **Portable**: one folder, one `index.html`, no build step, works offline via bundled assets

## Technical stack

Pure ES modules · Canvas 2D API · Three.js (CDN, for optional 3D view) · No framework · No build system

---

*Data source: airborne LiDAR survey, CRS EPSG:32616. Reference crowns manually digitised and QA'd.*
