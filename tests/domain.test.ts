import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankTask,taskPayload,filterTasks,defaultFilters,taskBlockers,wouldCreateCycle,wouldCreateParentCycle,githubRepo,githubPR,githubBranch} from '../src/domain.ts';
import type {Task,Dependency,Approval,Work} from '../src/domain.ts';
const task=(id:string,extra:Partial<Task>={}):Task=>({...blankTask('p1'),id,title:id,created_at:'2026-11-24T00:00:00Z',updated_at:'2026-11-24T00:00:00Z',...extra});
const edge=(task_id:string,depends_on_id:string):Dependency=>({project_id:'p1',task_id,depends_on_id});
test('task writes omit immutable timestamps and IDs',()=>{
 const t=task('a',{title:'  Example  '});
 const out=taskPayload({...t,owner_id:'unexpected'} as Task);
 assert.equal(out.title,'Example');assert.equal('id' in out,false);assert.equal('created_at' in out,false);assert.equal('updated_at' in out,false);assert.equal('owner_id' in out,false);
 assert.equal(out.project_id,'p1');
});
test('filters combine query, type, status and priority',()=>{
 const input=[task('A',{title:'Redesign editor',status:'ready',priority:1}),task('B',{title:'Redesign docs',status:'blocked',priority:1}),task('C',{title:'Redesign editor',status:'ready',priority:2}),task('D',{title:'Redesign epic',kind:'epic',status:'ready',priority:1})];
 assert.deepEqual(filterTasks(input,{...defaultFilters,query:'  redesign ',status:'ready',priority:'1',kind:'task'}).map(t=>t.id),['A']);
});
test('deterministic sorting does not mutate input',()=>{
 const input=[task('B',{priority:2}),task('A',{priority:0}),task('C',{priority:0})];
 assert.deepEqual(filterTasks(input,defaultFilters).map(t=>t.id),['A','C','B']);assert.deepEqual(input.map(t=>t.id),['B','A','C']);
 assert.deepEqual(filterTasks(input,{...defaultFilters,sort:'title'}).map(t=>t.id),['A','B','C']);
});
test('dependency cycles include direct and transitive cycles',()=>{
 const deps=[edge('A','B'),edge('B','C')];
 assert.equal(wouldCreateCycle('C','A',deps),true);assert.equal(wouldCreateCycle('A','A',deps),true);
 assert.equal(wouldCreateCycle('D','A',deps),false);
});
test('parent cycles and existing malformed parent chains are rejected',()=>{
 const tasks=[task('A',{parent_id:'B'}),task('B',{parent_id:'C'}),task('C')];
 assert.equal(wouldCreateParentCycle('C','A',tasks),true);assert.equal(wouldCreateParentCycle('A','C',tasks),false);
 assert.equal(wouldCreateParentCycle('D','A',[task('A',{parent_id:'B'}),task('B',{parent_id:'A'})]),true);
});
test('queue constraints identify unmet prerequisites, approvals and active sessions',()=>{
 const t=task('A',{status:'ready',requires_approval:true}),b=task('B',{status:'backlog'});
 const approval:Approval={id:'approval',project_id:'p1',task_id:'A',operation:'review',status:'approved'};
 const work:Work={id:'s',project_id:'p1',task_id:'A',status:'active',summary:'',next_step:'',started_at:'2026-11-24',heartbeat_at:'2026-11-24',lease_expires_at:'2026-11-24'};
 assert.deepEqual(taskBlockers(t,[t,b],[edge('A','B')],[],[work]),['Waiting for: B','Approval required','Active session']);
 assert.deepEqual(taskBlockers(t,[t,{...b,status:'done'}],[edge('A','B')],[approval],[]),[]);
 assert.deepEqual(taskBlockers(t,[t],[edge('A','missing')],[approval],[]),['Waiting for: Unknown prerequisite']);
});
test('GitHub link validation permits only expected repository and PR URLs',()=>{
 assert.equal(githubRepo('owner/repository'),'https://github.com/owner/repository');assert.equal(githubRepo('https://example.com'),null);
 assert.equal(githubPR('https://github.com/owner/repo/pull/1'),'https://github.com/owner/repo/pull/1');
 assert.equal(githubPR('javascript:alert(1)'),null);assert.equal(githubPR('https://github.com.evil.invalid/owner/repo/pull/1'),null);
 assert.equal(githubPR('https://github.com/owner/repo/issues/1'),null);
});

test('external links reject credentials, nonstandard ports and dot-segment repositories',()=>{
 for(const value of ['owner/.','owner/..','../repo','owner/repo?x=1','owner/repo#x'])assert.equal(githubRepo(value),null);
 for(const value of ['https://user@github.com/owner/repo/pull/1','https://github.com:444/owner/repo/pull/1','https://github.com/owner/repo/pull/0','https://github.com/owner/repo/pull/999999999999999999999'])assert.equal(githubPR(value),null);
 assert.equal(githubPR('https://github.com/owner/repo/pull/1?token=discard#fragment'),'https://github.com/owner/repo/pull/1');
 assert.equal(githubBranch('owner/repo','feature/test'),'https://github.com/owner/repo/tree/feature%2Ftest');
 assert.equal(githubBranch('owner/repo','..'),null);
});
