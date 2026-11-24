import React,{useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {db} from './lib/supabase';
import {message} from './domain';
import {Field} from './components/primitives';
import {Workspace} from './Workspace';
export function App(){
 const [session,setSession]=useState<Session|null>(null),[initial,setInitial]=useState(true),[authError,setAuthError]=useState('');
 useEffect(()=>{let alive=true;db.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);setAuthError(error?.message||'');setInitial(false)}});const {data}=db.auth.onAuthStateChange((_event,next)=>{if(alive){setSession(next);setInitial(false)}});return()=>{alive=false;data.subscription.unsubscribe()}},[]);
 if(initial)return <main className="login"><p>Initializing workspace…</p></main>;
 if(!session)return <Login error={authError}/>;
 return <Workspace key={session.user.id} session={session}/>;
}
function Login({error}:{error:string}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[notice,setNotice]=useState(error),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setNotice('');try{const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error}catch(e){setNotice(message(e))}finally{setBusy(false)}}
 return <main className="login"><form className="login-panel" onSubmit={submit}><div className="eyebrow">PRIVATE WORKSPACE / AUTHORIZATION</div><h1>OVERSEER<span>.</span></h1><p>One workspace. Total oversight.</p><Field label="Email"><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Password"><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field><button disabled={busy} className="primary">{busy?'Signing in…':'Sign in'}</button>{notice&&<p role="alert" className="error">{notice}</p>}<small>Access is provisioned by the workspace administrator.</small></form></main>
}
