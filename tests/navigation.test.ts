import test from 'node:test';
import assert from 'node:assert/strict';
import {tabs} from '../src/domain/tasks.ts';
import {navigationGroups} from '../src/domain/navigation.ts';
test('navigation groups contain every existing page exactly once',()=>{
 const all=navigationGroups.flatMap(group=>group.items);
 assert.equal(new Set(all).size,all.length);
 assert.deepEqual([...all].sort(),[...tabs].sort());
 assert.equal(new Set(navigationGroups.map(group=>group.label)).size,navigationGroups.length);
});
