import type {Tab} from '../domain';
const paths:Record<Tab,string[]>={
 Overview:['M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
 Projects:['M3 7V5h7l2 2h9v13H3z'],
 Tasks:['M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2'],
 Epics:['M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5'],
 Health:['M3 12h4l3-7 4 14 3-7h4'],
 'Execution queue':['M5 3l14 9-14 9z'],
 'Project memory':['M4 5c0-4 16-4 16 0v14c0 4-16 4-16 0z M4 5c0 4 16 4 16 0 M4 12c0 4 16 4 16 0'],
 Directives:['M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5'],
 Dependencies:['M6 3h5v5H6z M13 16h5v5h-5z M8.5 8v5h7v3'],
 Decisions:['M5 4v16 M5 6h14l-3 4H5 M5 14h12l-3 4H5'],
 'AI sessions':['M9 3v4 M15 3v4 M8 17v4 M16 17v4 M4 9h2 M18 9h2 M4 15h2 M18 15h2 M6 7h12v10H6z M9 12h1 M14 12h1'],
 Handover:['M3 8h17 M16 4l4 4-4 4 M21 16H4 M8 12l-4 4 4 4'],
 'AI context':['M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z'],
 Repositories:['M8 5l-5 7 5 7 M16 5l5 7-5 7 M14 3l-4 18'],
 Delivery:['M3 7h11v10H3z M14 10h4l3 3v4h-7 M7 17v2 M18 17v2'],
 Approvals:['M12 3l8 3v6c0 5-8 9-8 9S4 17 4 12V6z M8 12l3 3 5-5'],
 Activity:['M3 6h18 M3 12h13 M3 18h18 M19 10v4 M17 12h4'],
 Settings:['M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6']
};
export function NavIcon({tab}:{tab:Tab}){
 return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[tab].map(d=><path key={d} d={d}/>)}</svg>;
}
