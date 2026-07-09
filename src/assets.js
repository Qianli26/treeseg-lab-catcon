const jsonCache = new Map();
const imageCache = new Map();

export async function loadJson(path){
  if(jsonCache.has(path)) return jsonCache.get(path);
  const bundle = window.TreeSegAssetBundle;
  if(bundle && Object.prototype.hasOwnProperty.call(bundle, path)){
    jsonCache.set(path, bundle[path]);
    return bundle[path];
  }
  const response = await fetch(path);
  if(!response.ok) throw new Error(`${path}: ${response.status} ${response.statusText}`.trim());
  const data = await response.json();
  jsonCache.set(path, data);
  return data;
}

export function loadImage(path){
  if(imageCache.has(path)) return imageCache.get(path);
  const promise = new Promise((resolve, reject)=>{
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${path}`));
    image.src = path;
  });
  imageCache.set(path, promise);
  return promise;
}

export async function loadTeachingAssets(includeLas=false){
  const base = [
    loadJson('assets/app_metadata.json'),
    loadJson('assets/reference_crowns_final.json'),
    loadJson('assets/apex_points_final.json'),
    loadImage('assets/chm_height.png')
  ];
  if(includeLas) base.push(loadJson('assets/points_sample.json'));
  const data = await Promise.all(base);
  return includeLas
    ? {meta:data[0], refs:data[1], apex:data[2], chmImage:data[3], points:data[4]}
    : {meta:data[0], refs:data[1], apex:data[2], chmImage:data[3]};
}

export async function loadModelAssets(){
  const [core, mrcnn, yoloSeg, samApex, yoloDet] = await Promise.all([
    loadTeachingAssets(false),
    loadJson('assets/method_mask_rcnn_m1.json'),
    loadJson('assets/method_yolo_seg.json'),
    loadJson('assets/method_sam_apex.json'),
    loadJson('assets/method_yolo_det.json')
  ]);
  return {...core, mrcnn, yoloSeg, samApex, yoloDet};
}
