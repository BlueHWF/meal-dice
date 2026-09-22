export function randomFace(source=globalThis.crypto) {
  const value=new Uint32Array(1);
  do {source.getRandomValues(value);} while(value[0]>=4294967292);
  return value[0]%6;
}
export function validateImage(image) {
  if(!image||typeof image.url!=='string')return false;
  if(/^\.\/assets\/meal-[1-6]\.jpg$/.test(image.url)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image.url))return true;
  try {const u=new URL(image.url);return u.protocol==='https:'&&['upload.wikimedia.org','thumb.wikimedia.org'].includes(u.hostname);}catch{return false;}
}
const plain=value=>String(value||'').replace(/<[^>]*>/g,'').replaceAll('&amp;','&').trim();
async function query(endpoint,params,signal) {
  const response=await fetch(endpoint+'?'+new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',...params}),{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
  if(!response.ok)throw Error('Photo search unavailable');
  const data=await response.json();if(data.error)throw Error('Photo search failed');return data.query?.pages||[];
}
function toImages(pages) {
  return pages.sort((a,b)=>(a.index||0)-(b.index||0)).flatMap(page=>{
    const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
    if(!info||!['image/jpeg','image/png','image/webp'].includes(info.mime))return [];
    const image={url:info.thumburl||info.url,source:info.descriptionurl,title:page.title.replace(/^File:/,''),author:plain(meta.Artist?.value),license:plain(meta.LicenseShortName?.value),licenseUrl:meta.LicenseUrl?.value||'',note:'自动搜索结果，请确认是否符合菜名'};
    return validateImage(image)?[image]:[];
  });
}
export async function findImages(name,{known,signal=new AbortController().signal}={}) {
  const commons='https://commons.wikimedia.org/w/api.php';
  const imageInfo={prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'640'};
  const text=(known?.search||name).replace(/[|{}<>"\\]/g,' ').trim();
  const tasks=[query(commons,{generator:'search',gsrsearch:text+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'8',...imageInfo},signal).then(toImages)];
  if(!known)tasks.push(query('https://zh.wikipedia.org/w/api.php',{generator:'search',gsrsearch:name,gsrlimit:'4',prop:'pageimages',piprop:'name'},signal).then(async pages=>{
    const relevant=pages.filter(p=>p.pageimage&&(p.title.includes(name.replace(/饭$/,''))||name.includes(p.title)));
    return relevant.length?toImages(await query(commons,{titles:relevant.map(p=>'File:'+p.pageimage).join('|'),...imageInfo},signal)):[];
  }));
  const results=await Promise.allSettled(tasks);if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  // Prefer a matching encyclopedia article's lead photo before broad full-text hits.
  const images=[...(known?.image?[known.image]:[]),...results.toReversed().filter(r=>r.status==='fulfilled').flatMap(r=>r.value)];
  if(!images.length&&results.every(r=>r.status==='rejected'))throw Error('Search unavailable');
  const unique=images.filter((image,i,all)=>all.findIndex(x=>x.source===image.source)===i).slice(0,9);
  unique.remoteFailed=results.every(r=>r.status==='rejected');
  unique.remoteCount=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value).length;
  return unique;
}
