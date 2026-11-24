import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePreferences,defaultPreferences} from '../src/preferences.ts';
test('preferences fall back safely on corrupted or missing local storage',()=>{
 for(const value of [null,'{','null','42','[]'])assert.deepEqual(parsePreferences(value),defaultPreferences);
});
test('preferences accept only supported layout values',()=>{
 assert.deepEqual(parsePreferences(JSON.stringify({density:'compact',showShortcuts:false,defaultMode:'board',unknown:'x'})),{density:'compact',showShortcuts:false,defaultMode:'board'});
 assert.deepEqual(parsePreferences(JSON.stringify({density:'bad',showShortcuts:'no',defaultMode:'invalid'})),defaultPreferences);
});
