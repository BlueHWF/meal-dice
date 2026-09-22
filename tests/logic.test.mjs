import test from 'node:test';
import assert from 'node:assert/strict';
import {randomFace,validateImage,findImages} from '../dist/logic.js';
test('all six outcomes and rejected out-of-range samples',()=>{
 const samples=[4294967295,4294967294,4294967293,4294967292,0,1,2,3,4,5];
 const source={getRandomValues(a){a[0]=samples.shift();}};
 assert.deepEqual(Array.from({length:6},()=>randomFace(source)),[0,1,2,3,4,5]);
});
test('saved images accept photos and reject executable or unrelated URLs',()=>{
 for(const url of ['./assets/meal-1.jpg','https://upload.wikimedia.org/wikipedia/commons/a/a1/photo.jpg','https://thumb.wikimedia.org/photo.jpg','data:image/webp;base64,AAAA'])assert.equal(validateImage({url}),true);
 for(const url of ['javascript:alert(1)','data:image/svg+xml,<svg/>','https://upload.wikimedia.org.evil.example/a.jpg','http://upload.wikimedia.org/a.jpg','./assets/../../secret'])assert.equal(validateImage({url}),false);
});
test('network outage preserves known fallback but reports network failure',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline');};
 try{const found=await findImages('面条',{known:{search:'noodles',image:{url:'./assets/meal-2.jpg',source:'https://commons.wikimedia.org/wiki/File:Chinese_noodles.JPG'}}});assert.equal(found.length,1);assert.equal(found.remoteFailed,true);await assert.rejects(findImages('未找到的菜'));}finally{globalThis.fetch=original;}
});
test('cancelled photo search cannot supply stale replacement results',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({query:{pages:[]}})});
 try{const controller=new AbortController();controller.abort();await assert.rejects(findImages('面条',{signal:controller.signal}),{name:'AbortError'});}finally{globalThis.fetch=original;}
});
