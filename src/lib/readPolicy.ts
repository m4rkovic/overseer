// Bounded retries for read operations only. Never use this for writes.
export type ReadResult<T>={data:T;error:unknown;status:number};
export function abortError(){return new DOMException('Read cancelled','AbortError')}
export function checkAbort(signal:AbortSignal){if(signal.aborted)throw abortError()}
export function isTransientReadStatus(status:number){return [0,408,502,503,504,520].includes(status)}
function delay(ms:number,signal:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(abortError());return}
  const cancel=()=>{clearTimeout(timer);reject(abortError())};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve()},ms);
  signal.addEventListener('abort',cancel,{once:true});
 });
}
export async function readWithRetry<T>(request:()=>PromiseLike<ReadResult<T>>,signal:AbortSignal,wait=delay):Promise<T>{
 for(let attempt=0;attempt<2;attempt++){
  checkAbort(signal);
  const result=await request();
  checkAbort(signal);
  if(!result.error)return result.data;
  if(attempt===1||!isTransientReadStatus(result.status))throw result.error;
  await wait(350,signal);
 }
 throw new Error('Read failed');
}
export async function readPages<T>(fetchPage:(offset:number,size:number)=>Promise<T[]>,signal:AbortSignal,pageSize=500,maxPages=100):Promise<T[]>{
 const output:T[]=[];
 for(let page=0;page<maxPages;page++){
  checkAbort(signal);
  const rows=await fetchPage(page*pageSize,pageSize);
  checkAbort(signal);
  output.push(...rows);
  if(rows.length<pageSize)return output;
 }
 throw new Error('Workspace exceeds the safe read limit. Narrow data access before loading more records.');
}
