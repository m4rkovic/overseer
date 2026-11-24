import {useEffect,useRef} from 'react';
import type {RefObject} from 'react';

const selector='button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]';
export function useModalFocus(panelRef:RefObject<HTMLElement|null>,onClose:()=>void,blocked=false,initialSelector?:string){
 const current=useRef({onClose,blocked});current.current={onClose,blocked};
 useEffect(()=>{
  const panel=panelRef.current;if(!panel)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const focusable=()=>Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(el=>!el.closest('fieldset:disabled,[inert]')&&el.getClientRects().length>0);
  const initial=initialSelector?panel.querySelector<HTMLElement>(initialSelector):null;
  (initial&&!initial.matches(':disabled')&&!initial.closest('fieldset:disabled')?initial:focusable()[0]||panel).focus();
  function handle(event:KeyboardEvent){
   if(event.key==='Escape'&&!current.current.blocked){event.preventDefault();event.stopPropagation();current.current.onClose();return;}
   if(event.key!=='Tab')return;
   const items=focusable();
   if(!items.length){event.preventDefault();panel?.focus();return;}
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&(document.activeElement===first||!panel?.contains(document.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!panel?.contains(document.activeElement))){event.preventDefault();first.focus();}
  }
  panel.addEventListener('keydown',handle);
  return ()=>{
   panel.removeEventListener('keydown',handle);
   requestAnimationFrame(()=>{
    if(document.querySelector('[aria-modal="true"]'))return;
    if(previous&&previous!==document.body&&previous.isConnected&&!previous.closest('[inert]')&&!previous.matches(':disabled'))previous.focus();
    else document.querySelector<HTMLElement>('[data-modal-return]')?.focus();
   });
  };
 },[panelRef,initialSelector]);
}
