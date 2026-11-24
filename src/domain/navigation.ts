import type {Tab} from './tasks.ts';
export const navigationGroups:readonly {label:string;items:readonly Tab[]}[]=[
 {label:'Workspace',items:['Overview','Projects','Health']},
 {label:'Planning',items:['Tasks','Epics','Dependencies','Decisions']},
 {label:'Execution',items:['Execution queue','AI sessions','Approvals','Delivery']},
 {label:'Knowledge',items:['Project memory','Directives','AI context','Repositories']},
 {label:'System',items:['Handover','Activity','Settings']}
];
