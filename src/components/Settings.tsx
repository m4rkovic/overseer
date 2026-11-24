import {defaultPreferences} from '../lib/preferences';
import type {Preferences} from '../lib/preferences';
export function SettingsPanel({value,onChange,error}:{value:Preferences;onChange:(value:Preferences)=>void;error:string}){
 return <section><div className="section-head"><h2>Workspace settings</h2><button onClick={()=>onChange({...defaultPreferences})}>Reset preferences</button></div>
 <div className="record"><h3>Appearance</h3><label className="field"><span>Density</span><select value={value.density} onChange={e=>onChange({...value,density:e.target.value==='compact'?'compact':'comfortable'})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div>
 <div className="record"><h3>Task workspace</h3><label className="field"><span>Default task view on sign-in</span><select value={value.defaultMode} onChange={e=>onChange({...value,defaultMode:e.target.value as Preferences['defaultMode']})}><option value="table">List</option><option value="board">Board</option><option value="bulk">Bulk</option></select></label><label className="checkbox"><input type="checkbox" checked={value.showShortcuts} onChange={e=>onChange({...value,showShortcuts:e.target.checked})}/> Display shortcut hints</label></div>
 <p className="muted">Settings are browser-local and account-scoped. No external sync, tokens or background network calls.</p>{error&&<p role="alert">{error}</p>}</section>
}
