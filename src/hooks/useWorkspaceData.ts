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
 const mutationLock=useRef(false);
 const mounted=useRef(false);

 const refresh=useCallback(async()=>{
  if(!mounted.current)return false;
  const id=++requestId.current;
  setLoading(true);setError('');
  try{
   const next=await loadWorkspace();
   if(mounted.current&&id===requestId.current){setData(next);return true;}
   return false;
  }catch(e){
   if(mounted.current&&id===requestId.current)setError(message(e));
   return false;
  }finally{
   if(mounted.current&&id===requestId.current)setLoading(false);
  }
 },[]);
 useEffect(()=>{
  mounted.current=true;
  void refresh();
  return()=>{mounted.current=false;requestId.current++};
 },[refresh]);

 async function runMutation<T>(operation:()=>Promise<T>,complete:(result:T,loaded:boolean)=>void):Promise<boolean>{
  if(mutationLock.current||!mounted.current)return false;
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
 return {data,loading,busy,error,notice,setError,refresh,mutate,bulkApply};
}
