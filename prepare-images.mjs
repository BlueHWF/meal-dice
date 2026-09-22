import { mkdir, writeFile, readFile } from 'node:fs/promises';
const definitions = [
 ['鸡腿饭','🍗','悟饕池上飯包 雞腿飯包 20170414.jpg','chicken rice'],
 ['面条','🍜','Chinese noodles.JPG','Chinese noodles'],
 ['米粉','🥢','Guilin rice noodles in Beijing (20150915111711).jpg','Guilin rice noodles'],
 ['猪脚饭','🍖','Longjiang pork feet rice taken in Suzhou-20210925.jpg','pork feet rice'],
 ['出去吃','🍽️','HK Central City Hall lower block Chinese restaurant interior Oct-2012.jpg','Chinese restaurant interior'],
 ['凉拌鸡丝饭','🥗','Shredded Chicken with Rice.jpg','shredded chicken rice'],
];
const params = new URLSearchParams({action:'query',format:'json',formatversion:'2',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'640',titles:definitions.map(x=>'File:'+x[2]).join('|')});
const data = JSON.parse((await readFile(new URL('./image-metadata.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
await mkdir(new URL('./dist/assets/',import.meta.url),{recursive:true});
const defaults=[];
for(const [i,definition] of definitions.entries()) {
 const [name,emoji,title,search]=definition;
 const page=data.query.pages.find(p=>p.title.replaceAll('_',' ') === 'File:'+title);
 const info=page?.imageinfo?.[0]; if(!info) throw Error('Missing image '+title);
 const file='assets/meal-'+(i+1)+'.jpg';
 const m=info.extmetadata||{};
 const plain=s=>(s||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim();
 defaults.push({name,emoji,search,image:{url:'./'+file,remoteUrl:info.thumburl||info.url,source:info.descriptionurl,author:plain(m.Artist?.value),license:plain(m.LicenseShortName?.value),licenseUrl:m.LicenseUrl?.value||'',title,note:i===5?'鸡丝饭参考图，未注明凉拌':''}});
 console.log('Prepared '+name);
}
await writeFile(new URL('./dist/defaults.json',import.meta.url),JSON.stringify(defaults,null,2));
