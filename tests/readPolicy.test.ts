import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readWithRetry,readPages,isTransientReadStatus} from '../src/lib/readPolicy.ts';
const immediate=async()=>{};
test('successful read is never retried',async()=>{
 let calls=0;
 const result=await readWithRetry(async()=>{calls++;return {data:[1],error:null,status:200}},new AbortController().signal,immediate);
 assert.deepEqual(result,[1]);assert.equal(calls,1);
});
test('transient read failures get at most one retry',async()=>{
 let calls=0;
 const result=await readWithRetry(async()=>{calls++;return calls===1?{data:null,error:new Error('network'),status:503}:{data:42,error:null,status:200}},new AbortController().signal,immediate);
 assert.equal(result,42);assert.equal(calls,2);
 calls=0;
 await assert.rejects(readWithRetry(async()=>{calls++;return {data:null,error:new Error('unavailable'),status:503}},new AbortController().signal,immediate),/unavailable/);
 assert.equal(calls,2);
});
test('authentication, rate limits and validation errors are not retried',async()=>{
 for(const status of [400,401,403,404,409,429]){
  assert.equal(isTransientReadStatus(status),false);
  let calls=0;
  await assert.rejects(readWithRetry(async()=>{calls++;return {data:null,error:new Error('rejected'),status}},new AbortController().signal,immediate),/rejected/);
  assert.equal(calls,1);
 }
});
test('cancelled reads never start or retry',async()=>{
 const ac=new AbortController();ac.abort();let calls=0;
 await assert.rejects(readWithRetry(async()=>{calls++;return {data:null,error:null,status:200}},ac.signal,immediate),{name:'AbortError'});
 assert.equal(calls,0);
 const next=new AbortController();
 await assert.rejects(readWithRetry(async()=>{calls++;return {data:null,error:new Error('network'),status:503}},next.signal,async()=>{next.abort()}),{name:'AbortError'});
 assert.equal(calls,1);
});
test('cancellation during retry delay stops the second request',async()=>{
 const ac=new AbortController();let calls=0;
 const promise=readWithRetry(async()=>{calls++;return {data:null,error:new Error('network'),status:503}},ac.signal);
 setTimeout(()=>ac.abort(),5);
 await assert.rejects(promise,{name:'AbortError'});assert.equal(calls,1);
});
test('pagination preserves order and stops on a short page',async()=>{
 const offsets:number[]=[];
 const data=await readPages(async(offset,size)=>{offsets.push(offset);return [1,2,3,4,5].slice(offset,offset+size)},new AbortController().signal,2);
 assert.deepEqual(data,[1,2,3,4,5]);assert.deepEqual(offsets,[0,2,4]);
});
test('pagination rejects oversize result rather than silently truncating',async()=>{
 await assert.rejects(readPages(async()=>[1,2],new AbortController().signal,2,2),/safe read limit/);
});
test('pagination stops after cancellation during fetch',async()=>{
 const ac=new AbortController();let calls=0;
 await assert.rejects(readPages(async()=>{calls++;ac.abort();return [1,2]},ac.signal,2),{name:'AbortError'});assert.equal(calls,1);
});
