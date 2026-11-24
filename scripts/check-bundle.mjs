import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {gzipSync} from 'node:zlib';
const root='dist';
function walk(dir){return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):[path]})}
const assets=walk(root).filter(p=>/\.(js|css)$/.test(p)).map(path=>{
 const content=readFileSync(path);return {file:relative(root,path),bytes:content.length,gzip_bytes:gzipSync(content).length};
}).sort((a,b)=>b.bytes-a.bytes);
if(!assets.some(a=>a.file.endsWith('.js')))throw new Error('No JavaScript build assets found');
const totals=assets.reduce((a,b)=>({bytes:a.bytes+b.bytes,gzip_bytes:a.gzip_bytes+b.gzip_bytes}),{bytes:0,gzip_bytes:0});
const budget={total_js_css_gzip:200*1024,largest_js_gzip:130*1024};
const maxJs=Math.max(...assets.filter(a=>a.file.endsWith('.js')).map(a=>a.gzip_bytes));
console.log(JSON.stringify({assets,totals,maxJs,budget},null,2));
if(totals.gzip_bytes>budget.total_js_css_gzip||maxJs>budget.largest_js_gzip){console.error('Bundle exceeds budget; review before raising the limit.');process.exitCode=1;}
