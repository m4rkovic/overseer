import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankTask,buildTaskBlockerMap,defaultFilters} from '../src/domain.ts';
import type {Task,Project,Work,Activity,Approval} from '../src/domain.ts';
import {applyTemplate,epicProgress,projectHealth,filterActivity,emptyActivityFilters,parseViews} from '../src/planning.ts';
const task=(id:string,extra:Partial<Task>={}):Task=>({...blankTask('p'),id,title:id,...extra});
const project:Project={id:'p',name:'Project',description:'',repository:'',status:'active'};
test('release templates create draft content but never claim or publish work',()=>{
 const draft={...blankTask('p'),title:'Release',status:'backlog'};
 const out=applyTemplate(draft,'release');
 assert.equal(out.title,'Release');assert.equal(out.status,'backlog');assert.equal(out.requires_approval,true);assert.match(out.acceptance_criteria,/authorization/);assert.equal(draft.description,'');
 assert.equal(applyTemplate(draft,'unknown'),draft);
});
test('epic progress counts nested descendants once, excludes cancelled and other projects',()=>{
 const epic=task('e',{kind:'epic'}),nested=task('n',{kind:'epic',parent_id:'e'});
 const rows=[epic,nested,task('a',{parent_id:'e',status:'done'}),task('b',{parent_id:'n',status:'blocked'}),task('c',{parent_id:'n',status:'cancelled'}),task('x',{project_id:'other',parent_id:'e'})];
 const p=epicProgress(epic,rows);assert.deepEqual([p.total,p.done,p.blocked],[2,1,1]);
});
test('epic progress terminates on malformed parent cycles',()=>{
 const e=task('e',{kind:'epic',parent_id:'a'}),a=task('a',{parent_id:'e'});
 assert.equal(epicProgress(e,[e,a]).total,1);
});
test('health counts project-specific operational state without including cancelled work',()=>{
 const rows=[task('a',{status:'ready'}),task('b',{status:'ready',next_step:'Implement'}),task('c',{status:'blocked'}),task('d',{status:'cancelled'}),task('x',{project_id:'other'})];
 const work:Work={id:'w',project_id:'p',task_id:'b',status:'active',summary:'',next_step:'',started_at:'2026-01-01',heartbeat_at:'2026-01-01',lease_expires_at:'2026-01-02'};
 const approval:Approval={id:'a',project_id:'p',task_id:'c',status:'pending',operation:'test'};
 assert.deepEqual(projectHealth(project,rows,[rows[0]],[work],[approval],Date.parse('2026-01-03')),{open:3,ready:1,waiting:1,expired:1,blocked:1,pending:1,missingNext:2});
});
test('activity filters combine event, actor, time and task name',()=>{
 const activity=(id:string,extra:Partial<Activity>={}):Activity=>({id,project_id:'p',task_id:'t',event:'tasks.update',created_at:'2026-11-24T00:00:00Z',actor_source:'database',details:{},...extra});
 const rows=[activity('a'),activity('b',{event:'tasks.insert'}),activity('c',{actor_source:'authenticated'}),activity('d',{created_at:'2026-11-01T00:00:00Z'})];
 const out=filterActivity(rows,{...emptyActivityFilters,query:'editor',entity:'tasks',operation:'update',actor:'database',since:'7'},new Map([['t','Editor']]),Date.parse('2026-11-25'));
 assert.deepEqual(out.map(a=>a.id),['a']);
});
test('saved views safely reject malformed storage and cap list size',()=>{
 const valid={id:'1',name:'My view',scope:'p',mode:'board',filters:defaultFilters};
 assert.deepEqual(parseViews('{broken'),[]);assert.deepEqual(parseViews(JSON.stringify([valid,{...valid,mode:'invalid'},{...valid,filters:{...defaultFilters,priority:'9'}}])),[valid]);
 assert.equal(parseViews(JSON.stringify(Array.from({length:31},(_,i)=>({...valid,id:String(i)})))).length,30);
});
test('blocker index rejects missing or cross-project prerequisite and isolates approvals',()=>{
 const a=task('a',{requires_approval:true}),b=task('b',{project_id:'q',status:'done'});
 const map=buildTaskBlockerMap([a,b],[{project_id:'p',task_id:'a',depends_on_id:'b'}],[{id:'x',project_id:'q',task_id:'a',operation:'review',status:'approved'}],[]);
 assert.deepEqual(map.get('a'),['Waiting for: Unknown prerequisite','Approval required']);
});
