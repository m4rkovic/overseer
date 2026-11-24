export type Preferences={density:'comfortable'|'compact';showShortcuts:boolean;defaultMode:'table'|'board'|'bulk'};
export const defaultPreferences:Preferences={density:'comfortable',showShortcuts:true,defaultMode:'table'};
export function parsePreferences(value:string|null):Preferences{
 try{const p=JSON.parse(value||'null');if(!p||typeof p!=='object')return {...defaultPreferences};
 return {density:p.density==='compact'?'compact':'comfortable',showShortcuts:typeof p.showShortcuts==='boolean'?p.showShortcuts:true,defaultMode:['table','board','bulk'].includes(p.defaultMode)?p.defaultMode:'table'};
 }catch{return {...defaultPreferences}}
}
