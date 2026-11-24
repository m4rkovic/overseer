import {useState} from 'react';
export type Preferences={density:'comfortable'|'compact';showShortcuts:boolean;defaultMode:'table'|'board'|'bulk'};
export const defaultPreferences:Preferences={density:'comfortable',showShortcuts:true,defaultMode:'table'};
export function parsePreferences(value:string|null):Preferences{
 try{const p=JSON.parse(value||'null');if(!p||typeof p!=='object')return {...defaultPreferences};
 return {density:p.density==='compact'?'compact':'comfortable',showShortcuts:typeof p.showShortcuts==='boolean'?p.showShortcuts:true,defaultMode:['table','board','bulk'].includes(p.defaultMode)?p.defaultMode:'table'};
 }catch{return {...defaultPreferences}}
}
export function usePreferences(userId:string){
 const key='overseer.preferences.v1.'+userId;
 const [value,setValue]=useState<Preferences>(()=>{try{return parsePreferences(localStorage.getItem(key))}catch{return {...defaultPreferences}}});
 const [error,setError]=useState('');
 function update(next:Preferences){setValue(next);try{localStorage.setItem(key,JSON.stringify(next));setError('')}catch{setError('Preferences apply to this session only; browser storage is unavailable.')}}
 return {value,update,error};
}
