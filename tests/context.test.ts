import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSnapshot,matchPullRequest,rankReady,buildProjectContext} from '../src/context.ts';
import {blankTask} from '../src/domain.ts';
import type {Task,Project} from '../src/domain.ts';
import type {ContextData} from '../src/context.ts';
const project:Project={id:'p',name:'Example',repository:'owner/repo',status:'active',description:''};
const task=(id:string,extra:Partial<Task>={}):Task=>({...blankTask('p'),id,title:id,created_at:'2026-01-01',...extra});
const snapshot={format:'overseer-github-v1',repository:'owner/repo',captured_at:'2026-11-24T00:00:00Z',default_branch:'main',commits:[{sha:'a'.repeat(40),subject:'test',date:'2026-11-24T00:00:00Z'}],pull_requests:[{number:1,title:'PR',state:'OPEN',head:'feature',base:'main',updated_at:'2026-11-24T00:00:00Z'}]};
test('snapshot validates identity and strips unrecognized fields',()=>{
 const raw=JSON.stringify({...snapshot,token:'secret',commits:[{...snapshot.commits[0],token:'secret'}]});
 const result=parseSnapshot(raw,'OWNER/REPO');
 assert.equal(result.repository,'owner/repo');assert.doesNotMatch(JSON.stringify(result),/secret/);
 assert.throws(()=>parseSnapshot(raw,'other/repo'));
});
test('snapshot rejects malformed data and unsafe commit links',()=>{
 assert.throws(()=>parseSnapshot('{','owner/repo'));
 assert.throws(()=>parseSnapshot(JSON.stringify({...snapshot,commits:[{...snapshot.commits[0],sha:'../../bad'}]}),'owner/repo'));
 assert.throws(()=>parseSnapshot(JSON.stringify({...snapshot,pull_requests:[{...snapshot.pull_requests[0],state:'UNKNOWN'}]}),'owner/repo'));
 assert.throws(()=>parseSnapshot('x'.repeat(500001),'owner/repo'));
});
test('PR matching requires exact repository and GitHub host',()=>{
 const s=parseSnapshot(JSON.stringify(snapshot),'owner/repo');
 assert.equal(matchPullRequest(task('a',{pr_url:'https://github.com/owner/repo/pull/1'}),s)?.number,1);
 for(const url of ['https://github.com/other/repo/pull/1','https://github.com.evil.invalid/owner/repo/pull/1','https://github.com/owner/repo/issues/1','https://user@github.com/owner/repo/pull/1'])assert.equal(matchPullRequest(task('a',{pr_url:url}),s),undefined);
});
test('queue ranking preserves priority and never introduces new eligible tasks',()=>{
 const rows=[task('a',{priority:2}),task('b',{priority:1}),task('c',{priority:2})];
 assert.deepEqual(rankReady(rows,[{project_id:'p',task_id:'x',depends_on_id:'c'},{project_id:'other',task_id:'z',depends_on_id:'a'}]).map(t=>t.id),['b','c','a']);
 assert.deepEqual(rows.map(t=>t.id),['a','b','c']);
});
test('context scopes records and ignores mismatched snapshot',()=>{
 const data:ContextData={tasks:[task('a'),task('x',{project_id:'other'})],queue:[task('a',{next_step:'verify'}),task('x',{project_id:'other',title:'foreign-task'})],notes:[{id:'n',project_id:'p',title:'local',content:'local directive',category:'constraint'},{id:'x',project_id:'other',title:'foreign-note',content:'private',category:'context'}],decisions:[],works:[],approvals:[],deps:[]};
 const s=parseSnapshot(JSON.stringify(snapshot),'owner/repo');
 const out=buildProjectContext(project,data,s);
 assert.match(out,/local directive/);assert.match(out,/Next: verify/);assert.match(out,/not live verification/);assert.doesNotMatch(out,/foreign-task|foreign-note/);
 assert.doesNotMatch(buildProjectContext({...project,repository:'other/repo'},data,s),/Imported GitHub snapshot/);
});
