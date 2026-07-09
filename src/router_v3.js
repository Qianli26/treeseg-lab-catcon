/**
 * router_v3.js — same as router_v2.js except evaluation uses evaluationLab_v3.js
 * Key change: student apex marking removed from Evaluation Lab (07);
 * it belongs exclusively to Student Workbook (08) Task 1.
 */
import {overviewModule}      from './modules/overview.js?v=20260708-v3';
import {learnModule}         from './modules/learn_v2.js?v=20260708-v3';
import {dataExplorerModule}  from './modules/dataExplorer_v3.js?v=20260708-v3';
import {classicalLabModule}  from './modules/classicalLab_v2.js?v=20260708-v3';
import {mlLabModule}         from './modules/mlLab.js?v=20260708-v3';
import {dlLabModule}         from './modules/dlLab.js?v=20260708-v3';
import {evaluationLabModule} from './modules/evaluationLab_v3.js?v=20260708-v3';
import {studentTasksModule}  from './modules/studentTasks_v2.js?v=20260708-v3';
import {instructorModule}    from './modules/instructor.js?v=20260708-v3';

export const routes = [
  {path:'overview',   label:'Software Overview',    subtitle:'What the teaching workbench does',           title:'TreeSeg Lab Dashboard',       eyebrow:'Overview',                        module:overviewModule},
  {path:'learn',      label:'Problem Overview',     subtitle:'ITC detection and delineation concepts',     title:'Theory Learning',              eyebrow:'Problem and concepts',            module:learnModule},
  {path:'data',       label:'Data Explorer',        subtitle:'LAS, CHM, apex, and crown evidence',         title:'Explore Real LiDAR',           eyebrow:'LAS to CHM',                      module:dataExplorerModule},
  {path:'classical',  label:'Classical Algorithms', subtitle:'Local maxima, watershed, region growing',    title:'Classical Algorithm Lab',      eyebrow:'Rules and failure modes',         module:classicalLabModule},
  {path:'ml',         label:'Feature Bridge',       subtitle:'Hand-crafted cues to learned features',      title:'Feature Learning Bridge',      eyebrow:'Hand-crafted and learned features',module:mlLabModule},
  {path:'dl',         label:'Deep Learning Lab',    subtitle:'Mask R-CNN, YOLO-Seg, and SAM mechanisms',   title:'Deep Learning Lab',            eyebrow:'Mechanisms and representations',   module:dlLabModule},
  {path:'evaluation', label:'Evaluation Lab',       subtitle:'F1, IoU, omission, commission, split, merge',title:'Evaluation Lab',               eyebrow:'Model outputs and metrics',       module:evaluationLabModule},
  {path:'student',    label:'Student Workbook',     subtitle:'Mark · Tune · Compare · Prompt · Report',    title:'Student Task Mode',            eyebrow:'Annotation and reflection',       module:studentTasksModule},
  {path:'instructor', label:'Instructor Package',   subtitle:'Dataset, protocol, portability, extension',  title:'Instructor and Dataset',       eyebrow:'Teaching package',                module:instructorModule}
];

export function currentPath(){
  const raw = location.hash.replace(/^#\/?/, '').trim();
  return raw || 'overview';
}

export function routeByPath(path){
  return routes.find(r => r.path === path) || routes[0];
}
