import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankTask,groupTasksByStatus,isManualTaskStatus} from '../src/domain.ts';
import type {Task} from '../src/domain.ts';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const task=(id:string,status:string):Task=>({...blankTask('p1'),id,title:id,status});
test('task grouping preserves input order and includes each task exactly once',()=>{
 const rows=[task('a','ready'),task('b','done'),task('c','ready'),task('d','blocked')];
 const groups=groupTasksByStatus(rows);
 assert.deepEqual(groups.get('ready')?.map(t=>t.id),['a','c']);
 assert.deepEqual([...groups.values()].flat().map(t=>t.id).sort(),['a','b','c','d']);
 assert.deepEqual(rows.map(t=>t.id),['a','b','c','d']);
 assert.equal(groupTasksByStatus([]).size,0);
});
test('manual status transition cannot start an agent session or use an unknown status',()=>{
 for(const status of ['backlog','ready','blocked','review','done','cancelled'])assert.equal(isManualTaskStatus(status),true);
 for(const status of ['in_progress','invalid',''])assert.equal(isManualTaskStatus(status),false);
});
test('presentational components do not issue raw database queries',()=>{
 const dir=join(process.cwd(),'src','components');
 for(const name of readdirSync(dir).filter(n=>n.endsWith('.tsx'))){
  const text=readFileSync(join(dir,name),'utf8');
  assert.doesNotMatch(text,/\bdb\s*\.\s*from\s*\(/,name);
  assert.doesNotMatch(text,/from\s+['"][^'"]*\/supabase['"]/,name);
 }
});
