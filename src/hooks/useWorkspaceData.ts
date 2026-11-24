import {useCallback,useEffect,useRef,useState} from 'react';
import {message} from '../domain';
import type {Task} from '../domain';
import type {BulkPatch} from '../operations';
import {emptyWorkspace,loadWorkspace,updateTaskFields} from '../lib/workspaceApi';

export function useWorkspaceData(){
 const [data,setData]=useState(emptyWorkspace);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const requestId=useRef(0);
 const activeRead=useRef<AbortController|null>(null);
 const mutationLock=useRef(false);
 const mounted=useRef(false);
 const fresh=useRef(false);
 const [stale,setStale]=useState(true);

 const refresh=useCallback(async()=>{
  if(!mounted.current)return false;
  const id=++requestId.current;
  activeRead.current?.abort();
  const controller=new AbortController();
  activeRead.current=controller;
  const timeout=setTimeout(()=>controller.abort(),20000);
  fresh.current=false;setStale(true);setLoading(true);setError('');
  try{
   const next=await loadWorkspace(controller.signal);
   if(mounted.current&&id===requestId.current){setData(next);fresh.current=true;setStale(false);return true;}
   return false;
  }catch(e){
   if(mounted.current&&id===requestId.current)setError(controller.signal.aborted?'Read cancelled or timed out. Refresh to retry.':message(e));
   return false;
  }finally{
   clearTimeout(timeout);
   controller.abort();
   if(activeRead.current===controller)activeRead.current=null;
   if(mounted.current&&id===requestId.current)setLoading(false);
  }
 },[]);
 useEffect(()=>{
  mounted.current=true;
  void refresh();
  return()=>{mounted.current=false;requestId.current++;activeRead.current?.abort()};
 },[refresh]);

 async function runMutation<T>(operation:()=>Promise<T>,complete:(result:T,loaded:boolean)=>void):Promise<boolean>{
  if(mutationLock.current||!mounted.current)return false;
  if(!fresh.current){setError('Workspace data is stale or unavailable. Refresh before saving changes.');return false;}
  mutationLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   const result=await operation();
   if(!mounted.current)return false;
   const loaded=await refresh();
   if(!mounted.current)return false;
   complete(result,loaded);
   return true;
  }catch(e){
   if(mounted.current)setError(message(e));
   return false;
  }finally{
   mutationLock.current=false;
   if(mounted.current)setBusy(false);
  }
 }

 async function mutate(fn:()=>PromiseLike<{error:unknown}>){
  return runMutation(async()=>{const {error}=await fn();if(error)throw error;},
   (_,loaded)=>setNotice(loaded?'Changes saved.':'Changes saved. Refresh to load the latest state.'));
 }

 async function bulkApply(rows:Task[],patch:BulkPatch,activeTaskIds:ReadonlySet<string|null>){
  await runMutation(async()=>{
   let saved=0;const failures:string[]=[];
   for(const task of rows){
    if(!mounted.current)break;
    if(activeTaskIds.has(task.id)){failures.push(task.title+': active session');continue;}
    try{const result=await updateTaskFields(task,patch);if(result.error)throw result.error;saved++;}
    catch(e){failures.push(task.title+': '+message(e));}
   }
   return {saved,failures};
  },({saved,failures},loaded)=>{
   setNotice(saved+' of '+rows.length+' tasks updated.'+(!loaded?' Refresh required.':''));
   if(failures.length)setError(failures.join('\n'));
  });
 }
 return {data,loading,busy,stale,error,notice,setError,refresh,mutate,bulkApply};
}
