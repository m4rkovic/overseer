import {useState} from 'react';
import {parsePreferences,defaultPreferences} from '../preferences';
import type {Preferences} from '../preferences';
export type {Preferences} from '../preferences';
export {defaultPreferences} from '../preferences';
export function usePreferences(userId:string){
 const key='overseer.preferences.v1.'+userId;
 const [value,setValue]=useState<Preferences>(()=>{try{return parsePreferences(localStorage.getItem(key))}catch{return {...defaultPreferences}}});
 const [error,setError]=useState('');
 function update(next:Preferences){setValue(next);try{localStorage.setItem(key,JSON.stringify(next));setError('')}catch{setError('Preferences apply to this session only; browser storage is unavailable.')}}
 return {value,update,error};
}
