import type {ReactNode} from 'react';
import {useState} from 'react';
import {navigationGroups} from '../domain/navigation';
import {NavIcon} from './NavIcon';
import type {Project,Tab} from '../domain';
import type {Preferences} from '../preferences';

type Props={tab:Tab;scope:string;projects:Project[];email?:string;preferences:Preferences;busy:boolean;loading:boolean;notice:string;error:string;modalOpen:boolean;onNavigate:(tab:Tab)=>void;onScope:(id:string)=>void;onSignOut:()=>void;onRefresh:()=>void;onSearch:()=>void;onNewTask:()=>void;children:ReactNode};
export function WorkspaceShell({tab,scope,projects,email,preferences,busy,loading,notice,error,modalOpen,onNavigate,onScope,onSignOut,onRefresh,onSearch,onNewTask,children}:Props){
 const [collapsed,setCollapsed]=useState<ReadonlySet<string>>(new Set());
 return <div className={'shell density-'+preferences.density} inert={modalOpen}>
  <aside>
   <div className="brand">OVERSEER<span>.</span><small>Development workspace</small></div>
   <nav aria-label="Workspace navigation">{navigationGroups.map(group=>{
    const open=group.items.includes(tab)||!collapsed.has(group.label);
    return <div className="nav-group" key={group.label}>
     <button type="button" className="nav-group-toggle" aria-expanded={open} disabled={group.items.includes(tab)} onClick={()=>setCollapsed(previous=>{const next=new Set(previous);if(next.has(group.label))next.delete(group.label);else next.add(group.label);return next})}>{group.label}<span aria-hidden="true">{open?'−':'+'}</span></button>
     {open&&<div className="nav-items">{group.items.map(t=><button type="button" key={t} className={'nav-link'+(tab===t?' selected':'')} aria-current={tab===t?'page':undefined} onClick={()=>onNavigate(t)}><NavIcon tab={t}/><span>{t}</span></button>)}</div>}
    </div>
   })}</nav>
   <div className="aside-footer"><div className="eyebrow">Signed in</div><div className="email">{email}</div><button disabled={busy} onClick={onSignOut}>Sign out</button></div>
  </aside>
  <main className="workspace">
   <header>
    <div><div className="workspace-breadcrumb">Workspace <span aria-hidden="true">/</span> {navigationGroups.find(g=>g.items.includes(tab))?.label}</div><h1>{tab}</h1></div>
    <div className="actions">
     <select aria-label="Project filter" value={scope} onChange={e=>onScope(e.target.value)}><option value="">All projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
     <button disabled={loading||busy} onClick={onRefresh}>Refresh</button>
     <button data-modal-return onClick={onSearch} title={preferences.showShortcuts?'Alt+Shift+N: new task · Alt+Shift+R: refresh · Alt+Shift+T: tasks':undefined}>Search {preferences.showShortcuts&&<kbd>Ctrl K</kbd>}</button>
     <button className="primary" disabled={loading||busy} onClick={onNewTask}>+ Task</button>
    </div>
   </header>
   {notice&&<div className="notice" role="status">{notice}</div>}
   {error&&<div className="error" role="alert">{error}</div>}
   {loading&&<div className="muted" role="status">Loading workspace…</div>}
   {children}
  </main>
 </div>;
}
