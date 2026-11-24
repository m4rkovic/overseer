import {useState,useMemo,lazy,Suspense} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import {statuses,readable,defaultFilters,filterTasks,groupTasksByStatus,isManualTaskStatus} from '../domain';
import type {Task,TaskFilters,Project,Work} from '../domain';
import type {BulkPatch} from '../operations';
import type {ViewMode} from '../planning';
import {Empty} from './primitives';
import {SavedViews} from './Planning';
const BulkTasks=lazy(()=>import('./Operations').then(m=>({default:m.BulkTasks})));

type TaskDisplayProps = {
  rows: Task[];
  projectName: (id: string) => string;
  blockers: (task: Task) => string[];
  openDetail: (task: Task) => void;
};

export function TaskTable({rows,projectName,blockers,openDetail}:TaskDisplayProps){
  if(!rows.length)return <Empty>No tasks in this view.</Empty>;
  return <div className="table-wrap">
    <table>
      <thead><tr>{['Task','Project','Priority','Status','Next step','Constraints'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{rows.map(task=><tr key={task.id}>
        <td><button className="text-button" onClick={()=>openDetail(task)}>{task.title}</button><small>{task.kind}</small></td>
        <td>{projectName(task.project_id)}</td>
        <td className="mono">P{task.priority}</td>
        <td><span className={'status '+task.status}>{readable(task.status)}</span></td>
        <td>{task.next_step||'—'}</td>
        <td>{blockers(task).map((reason,i)=><small key={i}>{reason}</small>)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

type BoardProps=TaskDisplayProps&{
  disabled:boolean;
  activeTaskIds:ReadonlySet<string|null>;
  changeStatus:(id:string,status:string)=>Promise<void>;
};

function TaskBoard({rows,projectName,blockers,openDetail,disabled,activeTaskIds,changeStatus}:BoardProps){
  const [dragged,setDragged]=useState<string|null>(null);
  const lanes=useMemo(()=>groupTasksByStatus(rows),[rows]);
  return <div className="kanban">{statuses.map(status=>{
    const lane=lanes.get(status)||[];
    const acceptsDrop=!disabled&&!!dragged&&isManualTaskStatus(status)&&!activeTaskIds.has(dragged);
    return <div className={'lane'+(acceptsDrop?' drop-target':'')} key={status}
      onDragOver={e=>{if(acceptsDrop)e.preventDefault()}}
      onDrop={e=>{e.preventDefault();if(acceptsDrop&&dragged)void changeStatus(dragged,status);setDragged(null)}}>
      <h3>{readable(status)} <small>{lane.length}</small></h3>
      {lane.map(task=>{
        const reasons=blockers(task);
        return <button className="task-card" key={task.id} draggable={!disabled&&!activeTaskIds.has(task.id)}
          onDragStart={e=>{e.dataTransfer.setData('text/plain',task.id);e.dataTransfer.effectAllowed='move';setDragged(task.id)}}
          onDragEnd={()=>setDragged(null)} onClick={()=>openDetail(task)}>
          <small>{projectName(task.project_id)} · P{task.priority}</small>
          <strong>{task.title}</strong>
          {reasons.length>0&&<small>{reasons.join(' · ')}</small>}
        </button>;
      })}
    </div>;
  })}</div>;
}

type FilterProps={
  filters:TaskFilters;
  setFilters:Dispatch<SetStateAction<TaskFilters>>;
  search:string;
  setSearch:(value:string)=>void;
  mode:ViewMode;
  setMode:(mode:ViewMode)=>void;
};

function TaskFilterBar({filters,setFilters,search,setSearch,mode,setMode}:FilterProps){
  return <div className="section-head">
    <input aria-label="Search tasks" placeholder="Search tasks…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="actions">
      <select aria-label="Filter status" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>
        <option value="">All statuses</option>{statuses.map(s=><option key={s} value={s}>{readable(s)}</option>)}
      </select>
      <select aria-label="Filter priority" value={filters.priority} onChange={e=>setFilters({...filters,priority:e.target.value})}>
        <option value="">All priorities</option>{[0,1,2,3,4].map(p=><option key={p} value={p}>P{p}</option>)}
      </select>
      <select aria-label="Filter type" value={filters.kind} onChange={e=>setFilters({...filters,kind:e.target.value})}>
        <option value="">All types</option>{['epic','task','subtask'].map(k=><option key={k}>{k}</option>)}
      </select>
      <select aria-label="Sort tasks" value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value as TaskFilters['sort']})}>
        <option value="priority">Priority</option><option value="newest">Newest</option><option value="title">Title</option>
      </select>
      <button onClick={()=>{setFilters(defaultFilters);setSearch('')}}>Reset</button>
      {(['table','board','bulk'] as const).map(view=><button key={view} onClick={()=>setMode(view)} aria-pressed={mode===view}>{view==='table'?'List':view==='board'?'Board':'Bulk'}</button>)}
    </div>
  </div>;
}

type Props=FilterProps&{
  userId:string;
  scope:string;
  projects:Project[];
  tasks:Task[];
  works:Work[];
  setScope:(id:string)=>void;
  busy:boolean;
  loading:boolean;
  activeTaskIds:ReadonlySet<string|null>;
  projectName:TaskDisplayProps['projectName'];
  blockers:TaskDisplayProps['blockers'];
  openDetail:TaskDisplayProps['openDetail'];
  bulkApply:(rows:Task[],patch:BulkPatch)=>Promise<void>;
  changeStatus:(id:string,status:string)=>Promise<void>;
};

export function TasksView(props:Props){
  const {userId,scope,projects,tasks,works,filters,setFilters,search,setSearch,mode,setMode,setScope,busy,loading,activeTaskIds,projectName,blockers,openDetail,bulkApply,changeStatus}=props;
  const visibleTasks=useMemo(()=>filterTasks(tasks.filter(t=>!scope||t.project_id===scope),{...filters,query:search}),[tasks,scope,filters,search]);
  const display={rows:visibleTasks,projectName,blockers,openDetail};
  return <section>
    <TaskFilterBar filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} mode={mode} setMode={setMode}/>
    <SavedViews userId={userId} scope={scope} filters={{...filters,query:search}} mode={mode}
      onApply={v=>{setScope(projects.some(p=>p.id===v.scope)?v.scope:'');setFilters(v.filters);setSearch(v.filters.query);setMode(v.mode)}}/>
    {mode==='table'&&<TaskTable {...display}/>}
    {mode==='bulk'&&<Suspense fallback={<p role="status">Loading bulk view…</p>}><BulkTasks tasks={visibleTasks} sessions={works} busy={busy||loading} onApply={bulkApply} onOpen={openDetail}/></Suspense>}
    {mode==='board'&&<TaskBoard {...display} disabled={busy||loading} activeTaskIds={activeTaskIds} changeStatus={changeStatus}/>}
  </section>;
}
