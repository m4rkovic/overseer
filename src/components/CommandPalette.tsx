import {useRef,useState} from 'react';
import {useModalFocus} from '../hooks/useModalFocus';
import {tabs} from '../domain';
import type {Project,Task,Tab} from '../domain';
type Props={projects:Project[];tasks:Task[];projectName:(id:string)=>string;onNavigate:(tab:Tab)=>void;onProject:(id:string)=>void;onTask:(task:Task)=>void;onClose:()=>void};
export function CommandPalette({projects,tasks,projectName,onNavigate,onProject,onTask,onClose}:Props){
 const [query,setQuery]=useState('');
 const panel=useRef<HTMLElement>(null);
 const q=query.trim().toLowerCase();
 useModalFocus(panel,onClose,false,'input');
 return <div className="palette-overlay" onClick={onClose}>
  <section ref={panel} tabIndex={-1} className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={e=>e.stopPropagation()}>
   <div className="section-head"><h2>Command palette</h2><button onClick={onClose}>Esc</button></div>
   <input placeholder="Find a page, project or task…" aria-label="Search workspace" value={query} onChange={e=>setQuery(e.target.value)}/>
   <div className="palette-results">
    {tabs.filter(t=>t.toLowerCase().includes(q)).map(t=><button key={t} onClick={()=>onNavigate(t)}><small>Navigate</small>{t}</button>)}
    {projects.filter(p=>p.name.toLowerCase().includes(q)).map(p=><button key={p.id} onClick={()=>onProject(p.id)}><small>Project</small>{p.name}</button>)}
    {q&&tasks.filter(t=>t.title.toLowerCase().includes(q)).slice(0,20).map(t=><button key={t.id} onClick={()=>onTask(t)}><small>{projectName(t.project_id)} · P{t.priority}</small>{t.title}</button>)}
   </div>
  </section>
 </div>;
}
