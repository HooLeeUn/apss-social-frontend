"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "../../hooks/useI18n";
import { getMyProfile } from "../../lib/profile-feed/adapters";
import { getOnboardingStates, onboardingQueueKey, updateOnboardingState } from "../../lib/onboarding/api";
import { commonTourCopy, getTourDefinitions } from "../../lib/onboarding/tours";
import type { OnboardingState, OnboardingStatus, TourDefinition } from "../../lib/onboarding/types";

type PendingUpdate = { status: OnboardingStatus; currentStep: number | null };

function TourWelcomeModal({ title, body, resume, onSkip, onStart }: { title:string; body:string; resume:boolean; onSkip:()=>void; onStart:()=>void }) {
  const { locale } = useI18n(); const labels = commonTourCopy(locale);
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title">
    <div className="relative w-full max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-6 shadow-2xl">
      <button type="button" aria-label={labels.close} onClick={onSkip} className="absolute right-4 top-3 text-xl text-zinc-300">×</button>
      <h2 id="tour-welcome-title" className="pr-8 text-xl font-bold text-white">{resume ? labels.resumeTitle : title}</h2>
      <p className="mt-3 leading-6 text-zinc-300">{resume ? labels.resumeBody : body}</p>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onSkip} className="rounded-full border border-white/25 px-4 py-2 text-sm">{labels.skip}</button><button type="button" onClick={onStart} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white">{resume ? labels.continue : labels.start}</button></div>
    </div>
  </div>;
}

function GuidedTour({ tour, initialStep, onStep, onSkip, onFinish }: { tour:TourDefinition; initialStep:number; onStep:(n:number)=>void; onSkip:()=>void; onFinish:()=>void }) {
  const { locale } = useI18n(); const labels = commonTourCopy(locale); const mobile = typeof window !== "undefined" && matchMedia("(max-width: 767px)").matches;
  const available = useMemo(() => typeof document === "undefined" ? tour.steps : tour.steps.filter((step) => document.querySelector(step.target) || !step.optional), [tour]);
  const [index, setIndex] = useState(Math.min(initialStep, Math.max(available.length - 1, 0))); const [rect, setRect] = useState<DOMRect | null>(null); const step = available[index];
  useEffect(() => { if (!step) return; const target = document.querySelector(step.target) as HTMLElement | null; if (!target) { if (index < available.length - 1) window.setTimeout(()=>setIndex((n)=>n+1), 0); else window.setTimeout(onFinish, 0); return; } target.scrollIntoView({ behavior:"smooth", block:"center", inline:"center" }); let frame=0; const update=()=>setRect(target.getBoundingClientRect()); const timer=window.setTimeout(()=>{ update(); frame=requestAnimationFrame(update); },350); window.addEventListener("resize",update); window.addEventListener("scroll",update,true); return()=>{ clearTimeout(timer); cancelAnimationFrame(frame); window.removeEventListener("resize",update); window.removeEventListener("scroll",update,true); }; },[available.length,index,onFinish,step]);
  const move=(next:number)=>{ setIndex(next); onStep(next); }; if (!step || !rect) return null; const tooltipTop = rect.bottom + 14 + 280 < innerHeight ? rect.bottom + 14 : Math.max(12, rect.top - 270);
  return <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true"><div className="fixed rounded-xl transition-all duration-200" style={{left:rect.left-6,top:rect.top-6,width:rect.width+12,height:rect.height+12,boxShadow:"0 0 0 9999px rgba(0,0,0,.82)",pointerEvents:"none"}} />
    <div className="fixed inset-0" onClick={(e)=>e.preventDefault()} />
    <div className="fixed left-1/2 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-white/20 bg-zinc-950 p-5 shadow-2xl" style={{top:tooltipTop}}>
      <button type="button" aria-label={labels.close} onClick={onSkip} className="absolute right-4 top-3 text-xl">×</button><p className="text-xs text-blue-300">{index+1} / {available.length}</p><h2 className="mt-1 pr-7 text-lg font-bold">{step.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-300">{mobile && step.mobileBody ? step.mobileBody : step.body}</p>
      <div className="mt-5 flex justify-between"><button type="button" disabled={index===0} onClick={()=>move(index-1)} className="rounded-full border border-white/25 px-4 py-2 text-sm disabled:invisible">{labels.back}</button><button type="button" onClick={()=>index===available.length-1?onFinish():move(index+1)} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold">{index===available.length-1?labels.finish:labels.next}</button></div>
    </div></div>;
}

export default function OnboardingProvider() {
  const pathname=usePathname(); const { locale }=useI18n(); const definitions=useMemo(()=>getTourDefinitions(locale),[locale]); const tour=definitions.find((item)=>item.path(pathname));
  const [state,setState]=useState<OnboardingState|null>(null); const [user,setUser]=useState<string|null>(null); const [ready,setReady]=useState(false); const [running,setRunning]=useState(false);
  const persist=useCallback(async(status:OnboardingStatus,currentStep:number|null)=>{ if(!tour||!state||!user)return; const key=onboardingQueueKey(user,tour.id,state.version); const value:PendingUpdate={status,currentStep}; try { await updateOnboardingState(tour.id,status,currentStep); localStorage.removeItem(key); } catch { localStorage.setItem(key,JSON.stringify(value)); } setState((old)=>old?{...old,status,currentStep}:old); },[state,tour,user]);
  useEffect(()=>{ let cancelled=false; const reset=window.setTimeout(()=>{ setState(null); setReady(false); setRunning(false); },0); if(!tour)return()=>clearTimeout(reset); Promise.all([getOnboardingStates(),getMyProfile()]).then(([states,profile])=>{if(cancelled)return; const identity=String(profile?.username||"authenticated"); setUser(identity); const next=states.find((item)=>item.tour===tour.id)||null; setState(next); if(next){ const key=onboardingQueueKey(identity,tour.id,next.version); const queued=localStorage.getItem(key); if(queued&&navigator.onLine){ const value=JSON.parse(queued) as PendingUpdate; updateOnboardingState(tour.id,value.status,value.currentStep).then(()=>localStorage.removeItem(key)).catch(()=>undefined); } } }).catch(()=>undefined); return()=>{cancelled=true;clearTimeout(reset)}; },[tour]);
  useEffect(()=>{ if(!tour||!state||!["pending","in_progress"].includes(state.status))return; const check=()=>setReady(tour.readyTargets.every((selector)=>document.querySelector(selector))); const initialCheck=setTimeout(check,0); const observer=new MutationObserver(check); observer.observe(document.body,{childList:true,subtree:true}); const timeout=setTimeout(check,8000); return()=>{observer.disconnect();clearTimeout(timeout);clearTimeout(initialCheck)}; },[state,tour]);
  if(!tour||!state||!ready||!["pending","in_progress"].includes(state.status))return null;
  if(!running)return <TourWelcomeModal title={tour.welcomeTitle} body={tour.welcomeBody} resume={state.status==="in_progress"} onSkip={()=>void persist("skipped",null)} onStart={()=>{ if(state.status==="pending")void persist("in_progress",0); setRunning(true); }} />;
  return <GuidedTour tour={tour} initialStep={state.currentStep??0} onStep={(step)=>void persist("in_progress",step)} onSkip={()=>{setRunning(false);void persist("skipped",null)}} onFinish={()=>{setRunning(false);void persist("completed",null)}} />;
}
