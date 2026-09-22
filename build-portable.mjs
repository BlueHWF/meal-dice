import {readFile,writeFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const defaults=JSON.parse(await read('./dist/defaults.json'));
for(const meal of defaults)if(meal.image?.url.startsWith('./assets/')){
 const bytes=await readFile(new URL('./dist/'+meal.image.url,import.meta.url));
 meal.image.url='data:image/jpeg;base64,'+bytes.toString('base64');
}
const logic=(await read('./dist/logic.js')).replaceAll('export function ','function ').replaceAll('export async function ','async function ');
let main=await read('./dist/main.js');
main=main.replace(/^import .*?;\n/,'').replace(/let defaults;[\s\S]*?(?=const state=)/,'const defaults='+JSON.stringify(defaults)+';\n');
const css=(await read('./dist/style.css')).replace(/^@import[^;]+;\n/,'')+'\n.upload-button{border:0}\n';
// Validate the fully combined script, including identifier collisions, before delivery.
new Function(logic+'\n'+main);
const html=(await read('./dist/index.html')).replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>').replace('<script type="module" src="./main.js"></script>','<script type="module">'+logic+'\n'+main+'</script>');
await writeFile(new URL('./dist/portable.html',import.meta.url),html);
await writeFile(new URL('../吃饭骰子.html',import.meta.url),html);
console.log('Portable file written: 吃饭骰子.html ('+Buffer.byteLength(html)+' bytes)');
