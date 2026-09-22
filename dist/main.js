import {findImages,validateImage,randomFace} from './logic.js';
const $=selector=>document.querySelector(selector), storageKey='meal-dice-v1';
let defaults;
try{const r=await fetch('./defaults.json');if(!r.ok)throw Error();defaults=await r.json();}
catch{defaults=['鸡腿饭','面条','米粉','猪脚饭','出去吃','凉拌鸡丝饭'].map((name,i)=>({name,emoji:['🍗','🍜','🥢','🍖','🍽️','🥗'][i]}));}
const state={meals:structuredClone(defaults),rolling:false,winner:null,turns:0,editing:null,searchingAll:false};
const requests=Array(6).fill(null),timers=Array(6).fill(null),candidates=Array.from({length:6},()=>[]),statuses=Array(6).fill('');
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state.meals));$('#save-note').textContent='已保存在当前浏览器';return true;}catch{$('#save-note').textContent='浏览器无法保存，刷新后可能丢失修改';toast('浏览器存储空间不足或被禁用，修改仅在本次打开有效');return false;}}
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(saved)&&saved.length===6&&saved.every(m=>m&&typeof m.name==='string'&&m.name.trim()&&m.name.length<=30))state.meals=saved.map((m,i)=>({name:m.name.trim(),emoji:defaults[i].emoji,image:validateImage(m.image)?m.image:undefined}));}catch{}
function safeLink(url,text){const a=document.createElement('a');a.textContent=text;if(/^https:\/\//.test(url||'')){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}return a;}
function photo(meal,className){
  const fallback=()=>{const span=document.createElement('span');span.className=className==='face-image'?'face-fallback':'emoji';span.textContent=meal.emoji;return span;};
  if(!validateImage(meal.image))return fallback();
  const img=document.createElement('img');img.className=className;img.src=meal.image.url;img.alt=meal.image.note||meal.name;img.decoding='async';
  img.addEventListener('error',()=>{img.replaceWith(fallback());const i=state.meals.indexOf(meal);if(i>=0&&!requests[i]){statuses[i]='图片未加载，可重试或上传';refreshStatus(i);}},{once:true});return img;
}
function refreshStatus(i){
  const el=$(`[data-card="${i}"] .meal-status`);if(!el)return;
  el.textContent=statuses[i]||(state.meals[i].image?.note?'参考配图 · 点击可更换':state.meals[i].image?.url.startsWith('data:')&&!state.meals[i].image?.source?'自己的图片':state.meals[i].image?'已配图 · 点击可更换':'输入菜名，自动找图');
  el.classList.toggle('error',/未|失败|没有|空/.test(el.textContent));$(`[data-card="${i}"] .meal-refresh`).disabled=state.rolling||!!requests[i];
}
function refreshFace(i){
  const meal=state.meals[i],face=$(`[data-face="${i}"]`);face.replaceChildren(photo(meal,'face-image'));
  const label=document.createElement('span');label.className='face-label';label.textContent=meal.name;
  const number=document.createElement('span');number.className='face-number';number.textContent=i+1;face.append(label,number);
  $(`[data-card="${i}"] .meal-thumb-button`).replaceChildren(photo(meal,'meal-thumb'));refreshStatus(i);if(state.winner===i)$('#result-name').textContent=meal.name;
}
function render(){
  $('#cube').replaceChildren();$('#meal-list').replaceChildren();
  state.meals.forEach((meal,i)=>{
    const face=document.createElement('div');face.className='cube-face';face.dataset.face=i;$('#cube').append(face);
    const card=document.createElement('div');card.className='meal-card';card.dataset.card=i;
    card.innerHTML=`<button class="meal-thumb-button" aria-label="更换第 ${i+1} 面图片"></button><div class="meal-details"><input class="meal-name" maxlength="30" aria-label="第 ${i+1} 面餐食名称" autocomplete="off" spellcheck="false"><div class="meal-meta"><span class="meal-index">0${i+1}</span><span>·</span><span class="meal-status"></span></div></div><button class="meal-refresh" aria-label="搜索第 ${i+1} 面配图" title="搜索配图">✦</button>`;
    const input=card.querySelector('input');input.value=meal.name;
    input.addEventListener('input',()=>{
      cancelSearch(i);clearTimeout(timers[i]);const name=input.value.trim();input.setAttribute('aria-invalid',String(!name));
      if(!name){statuses[i]='名称不能为空';refreshStatus(i);return;}if(name===state.meals[i].name)return;
      state.meals[i].name=name;delete state.meals[i].image;candidates[i]=[];statuses[i]='准备寻找配图…';save();refreshFace(i);timers[i]=setTimeout(()=>searchFace(i),900);
    });
    input.addEventListener('blur',()=>{if(!input.value.trim()){input.value=state.meals[i].name;input.removeAttribute('aria-invalid');statuses[i]='';refreshStatus(i);}else if(timers[i]){clearTimeout(timers[i]);timers[i]=null;if(!state.meals[i].image&&!requests[i])searchFace(i);}});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}});
    card.querySelector('.meal-thumb-button').addEventListener('click',()=>openImages(i));card.querySelector('.meal-refresh').addEventListener('click',()=>searchFace(i,{cycle:true}));
    $('#meal-list').append(card);refreshFace(i);
  });
}
function cancelSearch(i){requests[i]?.abort();requests[i]=null;}
function imageLoads(image,signal){return new Promise(resolve=>{
  if(signal.aborted){resolve(false);return;}const probe=new Image();
  let timer;const done=ok=>{clearTimeout(timer);probe.onload=null;probe.onerror=null;signal.removeEventListener('abort',aborted);resolve(ok);};
  const aborted=()=>done(false);signal.addEventListener('abort',aborted,{once:true});timer=setTimeout(()=>done(false),8000);probe.onload=()=>done(true);probe.onerror=()=>done(false);probe.src=image.url;
});}
async function searchFace(i,{cycle=false}={}){
  if(state.rolling)return{ok:false,reason:'rolling'};clearTimeout(timers[i]);timers[i]=null;cancelSearch(i);
  const controller=new AbortController();requests[i]=controller;const meal=state.meals[i],name=meal.name;statuses[i]='正在搜索配图…';refreshStatus(i);refreshDialog();
  try{
    const found=await findImages(name,{known:defaults.find(m=>m.name===name),signal:controller.signal});
    if(controller.signal.aborted||state.meals[i]!==meal||name!==meal.name)return{ok:false,reason:'stale'};
    candidates[i]=found;
    if(found.length){
      const current=found.findIndex(image=>image.url===meal.image?.url||image.source===meal.image?.source);
      const start=cycle&&current>=0?(current+1)%found.length:0,ordered=[...found.slice(start),...found.slice(0,start)];
      const usable=await Promise.all(ordered.slice(0,6).map(image=>imageLoads(image,controller.signal)));
      if(controller.signal.aborted||state.meals[i]!==meal||name!==meal.name)return{ok:false,reason:'stale'};
      const chosen=usable.findIndex(Boolean);
      if(chosen<0){statuses[i]='图片暂时无法加载，可重试或上传';refreshStatus(i);return{ok:false,reason:'image-load'};}
      if(!found.remoteFailed||!meal.image)meal.image=ordered[chosen];
      statuses[i]=found.remoteFailed?'搜索暂不可用，已保留配图':!found.remoteCount?'未找到新图，使用默认配图':meal.image.note?'参考配图 · 点击可更换':'已更新配图';save();refreshFace(i);return{ok:!found.remoteFailed&&found.remoteCount>0,count:found.length};
    }
    statuses[i]=meal.image?'未找到新图，已保留原图':'没有合适配图，试试简称或上传';refreshStatus(i);return{ok:false,reason:'empty'};
  }catch(error){if(controller.signal.aborted)return{ok:false,reason:'cancelled'};statuses[i]=meal.image?'搜索暂不可用，已保留原图':'搜索暂不可用，可重试或上传';refreshStatus(i);return{ok:false,reason:'network'};}
  finally{if(requests[i]===controller){requests[i]=null;refreshStatus(i);refreshDialog();}}
}
async function searchAll(){
  if(state.searchingAll||state.rolling)return;state.searchingAll=true;$('#search-all').disabled=true;$('#search-all').textContent='正在为六面寻找配图…';const results=[];
  for(let i=0;i<6;i+=2)results.push(...await Promise.all([searchFace(i,{cycle:true}),searchFace(i+1,{cycle:true})]));
  state.searchingAll=false;$('#search-all').disabled=state.rolling;$('#search-all').textContent='✦ 为六面重新找图';const count=results.filter(r=>r?.ok).length;toast(count===6?'六个面的配图已更新':`已为 ${count} 个面找到配图，其他选项可重试或上传`);
}
function lock(locked){document.querySelectorAll('.meal-name,.meal-thumb-button,.meal-refresh,#reset-button').forEach(el=>el.disabled=locked);$('#search-all').disabled=locked||state.searchingAll;state.meals.forEach((_,i)=>refreshStatus(i));}
async function roll(){
  if(state.rolling)return{ok:false,reason:'骰子正在投掷'};
  state.rolling=true;$('#roll-button').disabled=true;lock(true);document.body.classList.add('rolling');
  const index=randomFace(),angles=[[0,0],[0,-90],[0,-180],[0,90],[-90,0],[90,0]];state.turns+=2;const turn=360*state.turns;
  $('#cube').style.transform=`rotateX(-16deg) rotateY(-25deg) rotateX(${turn+angles[index][0]}deg) rotateY(${turn+angles[index][1]}deg)`;
  $('#roll-label').textContent='好吃的，转起来…';$('.result-label').textContent='正在挑选今天的好滋味';
  await new Promise(r=>setTimeout(r,matchMedia('(prefers-reduced-motion: reduce)').matches?100:2050));
  state.winner=index;state.rolling=false;$('#roll-button').disabled=false;lock(false);document.body.classList.remove('rolling');$('#roll-label').textContent='再投一次';$('#result-name').textContent=state.meals[index].name;$('#result').classList.add('is-chosen');$('.result-label').textContent='今天就吃';
  document.querySelectorAll('.meal-card').forEach((card,i)=>card.classList.toggle('is-winner',i===index));return{ok:true,face:index+1,name:state.meals[index].name};
}
function openImages(i){if(state.rolling)return;state.editing=i;refreshDialog();$('#image-dialog').showModal();}
function refreshDialog(){
  if(state.editing===null)return;const i=state.editing,meal=state.meals[i];$('#image-title').textContent=`给「${meal.name}」换张图`;$('#image-description').textContent='自动寻找餐食照片，或上传你自己的图案。';
  $('#dialog-search').disabled=!!requests[i];$('#dialog-search').textContent=requests[i]?'正在搜索…':'✦ 自动搜索配图';const container=$('#image-candidates');container.replaceChildren();
  const available=[...(meal.image?[meal.image]:[]),...candidates[i]].filter((x,i,all)=>all.findIndex(p=>p.url===x.url)===i);
  available.forEach(image=>{const button=document.createElement('button');button.className='candidate';button.classList.toggle('selected',meal.image?.url===image.url);button.setAttribute('aria-label',`使用图片：${image.title||meal.name}`);
    const img=document.createElement('img');img.src=image.url;img.alt=image.title||meal.name;img.loading='lazy';img.addEventListener('error',()=>{button.disabled=true;img.remove();button.textContent='图片无法加载';},{once:true});button.append(img);
    button.addEventListener('click',()=>{cancelSearch(i);clearTimeout(timers[i]);meal.image=image;statuses[i]='';save();refreshFace(i);refreshDialog();toast('已更新骰子这一面');});container.append(button);
  });
  if(!available.length){const p=document.createElement('p');p.className='empty-search';p.textContent=statuses[i]||'点击“自动搜索配图”开始找图。上传图片只保存在当前浏览器。';container.append(p);}
  const credit=$('#image-credit'),image=meal.image;credit.replaceChildren();
  if(image?.source){credit.append('图片：',safeLink(image.source,image.author||'Wikimedia Commons'),' · ',safeLink(image.licenseUrl,image.license||'查看来源及许可'),'。图片以裁切方式展示。');if(image.note)credit.append(' '+image.note+'。');}
  else credit.textContent=image?'你上传的图片只保存在当前浏览器。':'搜索由 Wikimedia 提供，冷门菜名可能没有合适照片。';
}
async function upload(event){
  const file=event.target.files[0],i=state.editing;event.target.value='';if(!file||i===null)return;
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){toast('请选择 JPG、PNG、WebP 或 GIF 图片');return;}if(file.size>8*1024*1024){toast('请选择 8 MB 以内的图片');return;}
  try{const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas'),ratio=Math.min(1,900/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    cancelSearch(i);clearTimeout(timers[i]);state.meals[i].image={url:canvas.toDataURL('image/webp',.84),title:'自己的图片'};statuses[i]='';candidates[i]=[];const persisted=save();refreshFace(i);refreshDialog();if(persisted)toast('图片已换好，骰子同步更新');
  }catch{toast('这张图片无法读取，请换一张试试');}
}
function reset(){
  if(state.rolling||state.searchingAll)return;if(!confirm('恢复最初的六个餐食和图片？当前浏览器保存的自定义菜单将被替换。'))return;
  state.meals=structuredClone(defaults);state.winner=null;state.editing=null;for(let i=0;i<6;i++){cancelSearch(i);clearTimeout(timers[i]);statuses[i]='';candidates[i]=[];}
  save();render();$('#result-name').textContent='让骰子替你做决定';$('.result-label').textContent='六个选择，一个好胃口';$('#result').classList.remove('is-chosen');toast('已恢复默认六面菜单');
}
$('#roll-button').addEventListener('click',roll);$('#search-all').addEventListener('click',searchAll);$('#reset-button').addEventListener('click',reset);
$('#close-dialog').addEventListener('click',()=>$('#image-dialog').close());$('#image-dialog').addEventListener('close',()=>state.editing=null);
$('#image-dialog').addEventListener('click',e=>{if(e.target===$('#image-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#dialog-search').addEventListener('click',()=>{if(state.editing!==null)searchFace(state.editing,{cycle:true});});$('#image-upload').addEventListener('change',upload);
$('#upload-button').addEventListener('click',()=>$('#image-upload').click());
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!$('#image-dialog').open&&!e.target.closest('input,textarea,button,a,[contenteditable]')){e.preventDefault();roll();}});
render();
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();const tools=[
    {name:'read_meal_dice',title:'读取六面菜单',description:'读取当前六个选项和最近一次投掷结果。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({meals:state.meals.map((m,i)=>({face:i+1,name:m.name,hasImage:!!m.image})),winner:state.winner===null?null:state.winner+1})},
    {name:'roll_meal_dice',title:'投掷吃饭骰子',description:'实际投掷骰子，动画结束后返回随机结果并更新页面。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:roll},
    {name:'configure_meal_faces',title:'修改六面菜单',description:'修改指定面的餐食名称，保存在当前浏览器，自动搜索配图并更新骰子。',inputSchema:{type:'object',properties:{faces:{type:'array',minItems:1,maxItems:6,items:{type:'object',properties:{face:{type:'integer',minimum:1,maximum:6},name:{type:'string',minLength:1,maxLength:30}},required:['face','name'],additionalProperties:false}}},required:['faces'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{
      if(!input||!Array.isArray(input.faces)||!input.faces.length||input.faces.length>6||input.faces.some(f=>!Number.isInteger(f.face)||f.face<1||f.face>6||typeof f.name!=='string'||!f.name.trim()||f.name.length>30)||new Set(input.faces.map(f=>f.face)).size!==input.faces.length)throw Error('请提供不重复的 1–6 面编号和 1–30 字的非空名称');
      if(state.rolling||state.searchingAll)throw Error('请等待当前操作完成');
      for(const f of input.faces){const i=f.face-1;cancelSearch(i);clearTimeout(timers[i]);state.meals[i].name=f.name.trim();delete state.meals[i].image;candidates[i]=[];statuses[i]='';}save();render();const result=[];for(const f of input.faces)result.push({face:f.face,name:f.name.trim(),image:await searchFace(f.face-1)});return{faces:result};
    }}
  ];
  for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
