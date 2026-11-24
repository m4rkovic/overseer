import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planBulk,dependencyLayers,projectStats,handoverText,exportProject} from '../src/operations.ts';
import type {Task,Work,Project,Note,Decision,Dependency} from '../src/domain.ts';
const task=(id:string,extra:Partial<Task>={}):Task=>({id,project_id:'p1',parent_id:null,kind:'task',title:id,description:'',acceptance_criteria:'',next_step:'',branch:'',pr_url:'',test_result:'',status:'ready',priority:2,requires_approval:false,updated_at:'2026-11-24T00:00:00Z',...extra});
const work=(id:string,task_id:string,extra:Partial<Work>={}):Work=>({id,project_id:'p1',task_id,summary:'checkpoint',next_step:'verify',status:'active',started_at:'2026-11-24',heartbeat_at:'2026-11-24',lease_expires_at:'2026-11-24',...extra});
const edge=(task_id:string,depends_on_id:string,project_id='p1'):Dependency=>({project_id,task_id,depends_on_id});
const project=(id:string):Project=>({id,name:id,description:'',repository:'',status:'active'});
test('bulk operations skip active sessions, no-op and stale metadata',()=>{
 const tasks=[task('a'),task('b'),task('c',{updated_at:undefined}),task('d',{priority:0})];
 const plan=planBulk(tasks,new Set(['a','b','c','d']),[work('s','b')],{priority:0});
 assert.deepEqual(plan.eligible.map(t=>t.id),['a']);
 assert.deepEqual(plan.skipped.map(s=>s.reason),['Active work session','Refresh required','No change']);
});
test('bulk operations reject manual in-progress and invalid priorities',()=>{
 for(const patch of [{status:'in_progress'},{priority:5},{priority:1.2}]){
  assert.equal(planBulk([task('a')],new Set(['a']),[],patch).eligible.length,0);
 }
});
test('graph puts prerequisite before dependent and supports multiple paths',()=>{
 const g=dependencyLayers([task('a'),task('b'),task('c'),task('d')],[edge('b','a'),edge('c','a'),edge('d','b'),edge('d','c')]);
 assert.deepEqual(g.nodes.map(n=>[n.task.id,n.level]),[['a',0],['b',1],['c',1],['d',2]]);
 assert.equal(g.unresolved.length,0);
});
test('graph detects cycle and its unresolved dependents',()=>{
 const g=dependencyLayers([task('a'),task('b'),task('c'),task('d')],[edge('a','b'),edge('b','a'),edge('c','a')]);
 assert.deepEqual(g.unresolved.map(t=>t.id),['a','b','c']);assert.deepEqual(g.nodes.map(n=>n.task.id),['d']);
});
test('project stats exclude epics and cancelled work from completion',()=>{
 const tasks=[task('a',{status:'done'}),task('b',{status:'blocked'}),task('c',{kind:'epic'}),task('d',{status:'cancelled'})];
 assert.deepEqual(projectStats(tasks,[task('b'),task('foreign',{project_id:'p2'})],[work('s','b')]),{total:2,completed:1,open:1,blocked:1,ready:1,active:1});
});
test('handover includes only same-project directives and accepted decisions',()=>{
 const notes:Note[]=[{id:'n',project_id:'p1',title:'local',content:'keep',category:'constraint'},{id:'x',project_id:'p2',title:'foreign',content:'secret',category:'constraint'}];
 const decisions:Decision[]=[{id:'d',project_id:'p1',title:'accepted',rationale:'',outcome:'use this',status:'accepted'},{id:'e',project_id:'p1',title:'draft-only',rationale:'',outcome:'no',status:'proposed'}];
 const out=handoverText(project('p1'),task('a'),work('s','a'),notes,decisions);
 assert.match(out,/Next step: verify/);assert.match(out,/local: keep/);assert.match(out,/accepted: use this/);assert.doesNotMatch(out,/foreign|secret|draft-only/);
});
test('export is project scoped and rejects unknown projects',()=>{
 const data={projects:[project('p1'),project('p2')],tasks:[task('a'),task('b',{project_id:'p2'})],notes:[],decisions:[],works:[work('s','a'),work('x','b',{project_id:'p2'})],approvals:[],activity:[],deps:[edge('a','b','p2')]};
 const out=exportProject(data,'p1');assert.deepEqual(out.tasks.map(t=>t.id),['a']);assert.deepEqual(out.sessions.map(s=>s.id),['s']);assert.equal(out.dependencies.length,0);assert.equal(out.activity_limit,100);assert.throws(()=>exportProject(data,'missing'));
});
