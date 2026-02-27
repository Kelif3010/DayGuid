import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, auth, profilesApi, schedulesApi, tasksApi, completionsApi, stickersApi, settingsApi, mediaUpload, mediaUploadBlob } from "./lib/supabase";
import type { Profile, Schedule, Task, AppSettings } from "./lib/supabase";

/*══════════════════════════════════════════════════════════════
  DayGuide – Production PWA mit vollständiger Supabase-Anbindung
  Alle Daten persistent · Medien in Supabase Storage
  Statistik live · PIN persistent · Wochentag-Autofilter
══════════════════════════════════════════════════════════════*/

// ═══ CONSTANTS ═══════════════════════════════════════════════
const C={pri:"#4A90D9",priL:"#6BA5E7",ok:"#5CB85C",okL:"#7ED07E",warn:"#F0AD4E",warnL:"#F5C882",err:"#D9534F",
  bg:"#F8F9FA",t1:"#2D3748",t2:"#718096",t3:"#A0AEC0",bdr:"#E2E8F0",
  g50:"#F7FAFC",g100:"#EDF2F7",g200:"#E2E8F0",g300:"#CBD5E0",g400:"#A0AEC0",done:"#C4CDD5"};
const F="'Quicksand',sans-serif";
const TASK_COLORS=["#FFE4B5","#B3E5FC","#C8E6C9","#FFE0B2","#D1C4E9","#BBDEFB","#F0F4C3","#FFCDD2","#F8BBD0","#E1BEE7","#B2DFDB","#DCEDC8"];
const STICKERS=["⭐","🌟","🎉","🏆","💪","🦁","🌈","🚀","🎯","❤️","🦋","🐬","🌻","🍀","🎨","🎵","🦄","🐱","🌸","🎪"];
const WD_LABELS=["So","Mo","Di","Mi","Do","Fr","Sa"]; // JS getDay() order: 0=So
const WD_DISPLAY=["Mo","Di","Mi","Do","Fr","Sa","So"]; // Display order
const WD_MAP=[1,2,3,4,5,6,0]; // Display index → JS day number
const AVATARS=["🧒","👧","👦","👶","🧒🏽","👧🏻","👦🏾","🧒🏼"];
const PICTOS=[
  {k:"wake_up",e:"🌅",n:"Aufstehen"},{k:"teeth",e:"🪥",n:"Zähneputzen"},{k:"wash",e:"🧼",n:"Waschen"},
  {k:"shower",e:"🚿",n:"Duschen"},{k:"dress",e:"👕",n:"Anziehen"},{k:"breakfast",e:"🥣",n:"Frühstücken"},
  {k:"lunch",e:"🍽️",n:"Mittagessen"},{k:"dinner",e:"🍛",n:"Abendessen"},{k:"snack",e:"🍎",n:"Snack"},
  {k:"drink",e:"🥤",n:"Trinken"},{k:"school",e:"🏫",n:"Schule"},{k:"homework",e:"📚",n:"Hausaufgaben"},
  {k:"read",e:"📖",n:"Lesen"},{k:"play",e:"🎮",n:"Spielen"},{k:"outside",e:"🌳",n:"Draußen"},
  {k:"sport",e:"⚽",n:"Sport"},{k:"swim",e:"🏊",n:"Schwimmen"},{k:"bike",e:"🚲",n:"Fahrrad"},
  {k:"music",e:"🎵",n:"Musik"},{k:"art",e:"🎨",n:"Malen"},{k:"tv",e:"📺",n:"Fernsehen"},
  {k:"walk",e:"🚶",n:"Spazieren"},{k:"bath",e:"🛁",n:"Baden"},{k:"pajamas",e:"🧸",n:"Schlafanzug"},
  {k:"story",e:"📕",n:"Geschichte"},{k:"sleep",e:"🌙",n:"Schlafen"},{k:"medicine",e:"💊",n:"Medizin"},
  {k:"therapy",e:"🧩",n:"Therapie"},{k:"clean",e:"🧹",n:"Aufräumen"},{k:"shoes",e:"👟",n:"Schuhe"},
  {k:"jacket",e:"🧥",n:"Jacke"},{k:"bus",e:"🚌",n:"Bus"},{k:"car",e:"🚗",n:"Auto"},
  {k:"wait",e:"⏳",n:"Warten"},{k:"quiet",e:"🤫",n:"Ruhezeit"},{k:"pet",e:"🐶",n:"Haustier"},
  {k:"friends",e:"👫",n:"Freunde"},{k:"cook",e:"👨‍🍳",n:"Kochen"},{k:"grocery",e:"🛒",n:"Einkaufen"},
  {k:"doctor",e:"🏥",n:"Arzt"},
];
const DEFAULT_SETTINGS={pin_code:"1234",language:"de-DE",tts_rate:0.9,extension_minutes:5,
  vibration_enabled:true,sound_enabled:true};

// ═══ DB↔UI Mapper ════════════════════════════════════════════
type UITask={id:string;name:string;startTime:string;duration:number;icon:string;color:string;sortOrder:number;
  reminderType:string;enableMidReminders:boolean;ttsText:string;midReminderText:string;
  imageUrl:string|null;videoUrl:string|null;audioUrl:string|null;extensionMinutes:number;scheduleId:string};

const dbToUI=(t:Task):UITask=>({id:t.id,name:t.name,startTime:t.start_time,duration:t.duration_minutes,
  icon:t.icon_emoji||"📌",color:t.color,sortOrder:t.sort_order,reminderType:t.reminder_type,
  enableMidReminders:t.enable_mid_reminders,ttsText:t.tts_text||"",midReminderText:t.mid_reminder_text||"",
  imageUrl:t.image_url||null,videoUrl:t.video_url||null,audioUrl:t.audio_url||null,
  extensionMinutes:t.extension_minutes||5,scheduleId:t.schedule_id});

const uiToDB=(t:UITask):Partial<Task>=>({name:t.name,start_time:t.startTime,duration_minutes:t.duration,
  icon_emoji:t.icon,color:t.color,sort_order:t.sortOrder,reminder_type:t.reminderType as any,
  enable_mid_reminders:t.enableMidReminders,tts_text:t.ttsText,mid_reminder_text:t.midReminderText,
  image_url:t.imageUrl ?? undefined,video_url:t.videoUrl ?? undefined,audio_url:t.audioUrl ?? undefined,
  extension_minutes:t.extensionMinutes});

const getAvatar=(p:Profile,idx:number)=>p.avatar_url||AVATARS[idx%AVATARS.length];

// ═══ STYLES ══════════════════════════════════════════════════
const lbl:any={display:"block",fontSize:13,fontWeight:700,color:C.t2,marginBottom:6,fontFamily:F};
const inp:any={width:"100%",padding:"11px 14px",borderRadius:12,border:`1.5px solid ${C.bdr}`,fontSize:14,
  fontFamily:F,color:C.t1,background:C.g50,outline:"none",marginBottom:14,boxSizing:"border-box" as const};

// ═══ SPINNER ═════════════════════════════════════════════════
function Spinner({text="Laden..."}:{text?:string}){
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
    height:"100vh",background:C.bg,fontFamily:F}}>
    <div style={{width:40,height:40,border:`4px solid ${C.g200}`,borderTopColor:C.pri,borderRadius:"50%",
      animation:"spin 0.8s linear infinite",marginBottom:16}}/>
    <p style={{fontSize:16,color:C.t2,fontWeight:600}}>{text}</p>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

// ═══ CONFETTI ════════════════════════════════════════════════
function Confetti({show,onDone}:{show:boolean;onDone?:()=>void}){
  const [p,setP]=useState<any[]>([]);
  useEffect(()=>{if(!show){setP([]);return;}
    setP(Array.from({length:50},(_,i)=>({id:i,x:Math.random()*100,d:Math.random()*0.5,dur:1.5+Math.random()*1.5,
      sz:8+Math.random()*14,c:["#FFD700","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#FF69B4"][i%8],r:Math.random()*360})));
    const t=setTimeout(()=>{setP([]);onDone?.()},3000);return()=>clearTimeout(t);
  },[show]);
  if(!p.length)return null;
  return <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
    {p.map(v=><div key={v.id} style={{position:"absolute",left:`${v.x}%`,top:"-20px",width:v.sz,height:v.sz,
      backgroundColor:v.c,borderRadius:v.id%3===0?"50%":"3px",transform:`rotate(${v.r}deg)`,
      animation:`cF ${v.dur}s ease-in ${v.d}s forwards`}}/>)}
    <style>{`@keyframes cF{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style>
  </div>;
}

// ═══ CIRCLE TIMER ════════════════════════════════════════════
function CircTimer({rem,total,size=200}:{rem:number;total:number;size?:number}){
  const pct=total>0?rem/total:0;const color=pct>0.25?C.ok:pct>0.1?C.warn:C.err;
  const r=(size-20)/2,circ=2*Math.PI*r,off=circ*(1-pct);const m=Math.floor(rem/60),s=rem%60;
  return <div style={{position:"relative",width:size,height:size}}>
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.g200} strokeWidth="10"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={off} style={{transition:"stroke-dashoffset 1s linear,stroke 0.5s ease"}}/>
    </svg>
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <span style={{fontFamily:F,fontSize:size*0.24,fontWeight:700,color:C.t1,fontVariantNumeric:"tabular-nums"}}>{m}:{s.toString().padStart(2,"0")}</span>
      <span style={{fontFamily:F,fontSize:size*0.09,color:C.t2,marginTop:2}}>Minuten</span>
    </div>
  </div>;
}

// ═══ ACTION BUTTON ═══════════════════════════════════════════
function ABtn({label,icon,color,onClick,sz="lg",disabled=false,tabIndex=0}:
  {label:string;icon:string;color:string;onClick:()=>void;sz?:string;disabled?:boolean;tabIndex?:number}){
  const [p,setP]=useState(false);const big=sz==="lg";
  return <button onClick={onClick} disabled={disabled} tabIndex={tabIndex}
    onTouchStart={()=>setP(true)} onTouchEnd={()=>setP(false)}
    onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onClick();}}
    style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:big?5:3,
      padding:big?"16px 28px":"10px 16px",minWidth:big?140:100,minHeight:big?64:48,background:disabled?"#ccc":color,
      border:"none",borderRadius:18,cursor:disabled?"default":"pointer",color:"#fff",
      boxShadow:p?"0 1px 4px rgba(0,0,0,0.1)":"0 4px 14px rgba(0,0,0,0.12)",
      transform:p?"scale(0.95)":"scale(1)",transition:"all 0.12s ease",fontFamily:F,
      WebkitTapHighlightColor:"transparent",outline:"none"}}>
    <span style={{fontSize:big?26:20,lineHeight:"1"}}>{icon}</span>
    <span style={{fontSize:big?15:12,fontWeight:700,letterSpacing:0.2}}>{label}</span>
  </button>;
}

// ═══ TIMELINE ════════════════════════════════════════════════
function Timeline({tasks,ci,doneSet}:{tasks:UITask[];ci:number;doneSet:Set<string>}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const el=ref.current?.children[ci*2] as HTMLElement;
    el?.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"});},[ci]);
  return <div ref={ref} style={{display:"flex",alignItems:"center",gap:5,padding:"10px 16px",
    background:"rgba(255,255,255,0.92)",backdropFilter:"blur(10px)",borderRadius:18,
    boxShadow:"0 2px 10px rgba(0,0,0,0.05)",overflowX:"auto",maxWidth:"100%"}}>
    {tasks.map((t,i)=>{const dn=doneSet.has(t.id),cur=i===ci;
      return <div key={t.id} style={{display:"flex",alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,
          opacity:dn?0.35:cur?1:0.5,transform:cur?"scale(1.18)":"scale(1)",transition:"all 0.3s ease"}}>
          <div style={{width:cur?50:40,height:cur?50:40,borderRadius:"50%",
            background:dn?C.done:cur?t.color||C.priL:C.g200,
            border:cur?`3px solid ${C.pri}`:"2px solid transparent",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:cur?22:18,
            boxShadow:cur?`0 0 0 4px ${C.pri}20`:"none",transition:"all 0.3s"}}>{dn?"✓":t.icon}</div>
          <span style={{fontFamily:F,fontSize:9,fontWeight:600,color:cur?C.t1:C.t2,maxWidth:56,textAlign:"center",
            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</span>
        </div>
        {i<tasks.length-1&&<div style={{width:16,height:2,margin:"0 1px",marginBottom:18,background:dn?C.done:C.g300}}/>}
      </div>;})}
  </div>;
}

// ═══ AUDIO RECORDER with Supabase Upload ═════════════════════
function AudioRec({onRecorded,existingUrl,userId}:{onRecorded:(url:string|null)=>void;existingUrl:string|null;userId:string}){
  const [rec,setRec]=useState(false);const [dur,setDur]=useState(0);const [url,setUrl]=useState(existingUrl);
  const [uploading,setUploading]=useState(false);
  const mr=useRef<MediaRecorder|null>(null);const chunks=useRef<Blob[]>([]);const tmr=useRef<any>(null);
  const start=async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mimeType=MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":"audio/mp4";
    const m=new MediaRecorder(stream,{mimeType});chunks.current=[];
    m.ondataavailable=e=>{if(e.data.size>0)chunks.current.push(e.data);};
    m.onstop=async()=>{const blob=new Blob(chunks.current,{type:mimeType});
      stream.getTracks().forEach(t=>t.stop());setRec(false);
      // Upload to Supabase
      setUploading(true);
      try{const ext=mimeType.includes("webm")?"webm":"mp4";
        const pubUrl=await mediaUploadBlob(blob,userId,`recording_${Date.now()}.${ext}`);
        setUrl(pubUrl);onRecorded(pubUrl);
      }catch(e){console.warn("Audio upload failed, using local URL");
        const localUrl=URL.createObjectURL(blob);setUrl(localUrl);onRecorded(localUrl);}
      setUploading(false);};
    m.start(250);mr.current=m;setRec(true);setDur(0);tmr.current=setInterval(()=>setDur(d=>d+1),1000);
  }catch{alert("Mikrofon-Zugriff nicht möglich.")}};
  const stop=()=>{mr.current?.stop();clearInterval(tmr.current);};
  const del=()=>{setUrl(null);onRecorded(null);};
  const fmt=(s:number)=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
  return <div style={{background:C.g50,borderRadius:14,padding:12,border:`1px solid ${C.bdr}`}}>
    {uploading?<div style={{display:"flex",alignItems:"center",gap:8,padding:4}}>
      <div style={{width:18,height:18,border:`3px solid ${C.g200}`,borderTopColor:C.pri,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <span style={{fontFamily:F,fontSize:13,color:C.t2}}>Wird hochgeladen...</span></div>
    :url&&!rec?<div style={{display:"flex",alignItems:"center",gap:8}}>
      <audio src={url} controls style={{flex:1,height:36,borderRadius:8}}/>
      <button onClick={del} tabIndex={0} style={{width:36,height:36,borderRadius:10,border:"none",background:C.err+"15",color:C.err,cursor:"pointer",fontSize:15,
        display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button></div>
    :rec?<div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:C.err,animation:"pulse 1s infinite"}}/>
      <span style={{fontFamily:F,fontWeight:600,color:C.t1}}>{fmt(dur)}</span><div style={{flex:1}}/>
      <button onClick={stop} tabIndex={0} style={{padding:"8px 18px",borderRadius:10,border:"none",background:C.err,color:"#fff",cursor:"pointer",fontFamily:F,fontWeight:600}}>⏹ Stopp</button></div>
    :<button onClick={start} tabIndex={0} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:10,
      border:`1.5px dashed ${C.pri}55`,background:C.pri+"08",cursor:"pointer",fontFamily:F,fontWeight:600,fontSize:13,
      color:C.pri,width:"100%",justifyContent:"center"}}>🎤 Aufnahme starten</button>}
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

// ═══ MEDIA UPLOAD with Supabase Storage ══════════════════════
function MediaUp({accept,label,icon,onFile,currentUrl,userId,fileType}:
  {accept:string;label:string;icon:string;onFile:(url:string|null)=>void;currentUrl:string|null;userId:string;fileType:"image"|"video"}){
  const ref=useRef<HTMLInputElement>(null);const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState(currentUrl);const [prog,setProg]=useState<number|null>(null);
  useEffect(()=>setPreview(currentUrl),[currentUrl]);
  const handle=async(e:any)=>{const f=e.target.files?.[0];if(!f)return;
    setUploading(true);setProg(10);
    try{
      // Show local preview immediately
      setPreview(URL.createObjectURL(f));setProg(40);
      // Upload to Supabase Storage
      const pubUrl=await mediaUpload(f,userId,fileType);
      setProg(100);setPreview(pubUrl);onFile(pubUrl);
    }catch(err){console.warn("Upload failed:",err);
      // Keep local preview as fallback
      onFile(preview);}
    setProg(null);setUploading(false);};
  const rm=()=>{setPreview(null);onFile(null);};
  return <div>
    {preview?<div style={{position:"relative",borderRadius:14,overflow:"hidden",border:`1px solid ${C.bdr}`,marginBottom:8}}>
      {accept?.includes("image")?<img src={preview} alt="" style={{width:"100%",height:110,objectFit:"cover"}}/>
      :<video src={preview} controls playsInline style={{width:"100%",height:110,objectFit:"cover"}}/>}
      <button onClick={rm} tabIndex={0} style={{position:"absolute",top:6,right:6,width:28,height:28,borderRadius:8,border:"none",
        background:"rgba(0,0,0,0.55)",color:"#fff",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      {uploading&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:4,background:C.g200}}>
        <div style={{height:"100%",width:`${prog||0}%`,background:C.pri,transition:"width 0.3s"}}/></div>}</div>
    :<button onClick={()=>ref.current?.click()} tabIndex={0} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",borderRadius:12,
      border:`1.5px dashed ${C.bdr}`,background:"white",cursor:"pointer",fontFamily:F,fontWeight:600,fontSize:13,color:C.t2,
      width:"100%",justifyContent:"center",marginBottom:8}}>{icon} {label}</button>}
    <input ref={ref} type="file" accept={accept} onChange={handle} style={{display:"none"}}/>
  </div>;
}

// ═══ PIN DIALOG ══════════════════════════════════════════════
function PinDialog({onOk,onCancel,correctPin}:{onOk:()=>void;onCancel:()=>void;correctPin:string}){
  const [pin,setPin]=useState("");const [err,setErr]=useState(false);const [shake,setShake]=useState(false);
  const digit=(d:string)=>{if(pin.length>=4)return;const n=pin+d;setPin(n);setErr(false);
    if(n.length===4){if(n===correctPin)onOk();else{setErr(true);setShake(true);setTimeout(()=>{setPin("");setShake(false);},500);}}};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(6px)",
    display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,fontFamily:F}}>
    <div style={{background:"white",borderRadius:28,padding:"32px 36px",width:300,textAlign:"center",
      boxShadow:"0 20px 60px rgba(0,0,0,0.2)",animation:shake?"shake 0.4s ease":"none"}}>
      <div style={{fontSize:36,marginBottom:10}}>🔒</div>
      <h3 style={{fontSize:18,fontWeight:700,color:C.t1,margin:"0 0 4px"}}>Eltern-Bereich</h3>
      <p style={{fontSize:13,color:C.t2,margin:"0 0 20px"}}>PIN eingeben</p>
      <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:20}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:44,height:44,borderRadius:12,
          border:`2px solid ${pin.length>i?err?C.err:C.pri:C.g300}`,
          background:pin.length>i?err?C.err+"12":C.pri+"12":C.g50,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,
          color:pin.length>i?err?C.err:C.pri:C.t3,transition:"all 0.12s"}}>{pin.length>i?"●":""}</div>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:220,margin:"0 auto"}}>
        {[1,2,3,4,5,6,7,8,9,null,0,"⌫"].map((d,i)=>d===null?<div key={i}/>:
          <button key={i} tabIndex={0} onClick={()=>typeof d==="number"?digit(String(d)):setPin(p=>p.slice(0,-1))}
            style={{height:50,borderRadius:12,border:"none",background:typeof d==="number"?C.g50:"transparent",
              fontSize:typeof d==="number"?20:18,fontWeight:700,color:C.t1,cursor:"pointer",fontFamily:F}}>{d}</button>)}</div>
      {err&&<p style={{color:C.err,fontSize:12,fontWeight:600,marginTop:10}}>Falsche PIN</p>}
      <button onClick={onCancel} tabIndex={0} style={{marginTop:16,padding:"8px 20px",borderRadius:10,border:"none",
        background:C.g100,color:C.t2,cursor:"pointer",fontFamily:F,fontWeight:600,fontSize:12}}>Abbrechen</button>
    </div>
    <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
  </div>;
}

// ═══ TASK EDITOR ═════════════════════════════════════════════
function TaskEditor({task,onSave,onCancel,onDelete,userId}:
  {task:UITask;onSave:(t:UITask)=>void;onCancel:()=>void;onDelete?:(id:string)=>void;userId:string}){
  const [f,setF]=useState({...task});const [tab,setTab]=useState("basic");const [saving,setSaving]=useState(false);
  const u=(k:string,v:any)=>setF((p:any)=>({...p,[k]:v}));
  const testTTS=()=>{if(f.ttsText&&window.speechSynthesis){window.speechSynthesis.cancel();
    const ut=new SpeechSynthesisUtterance(f.ttsText);ut.lang="de-DE";ut.rate=0.9;window.speechSynthesis.speak(ut);}};
  const save=async()=>{setSaving(true);await onSave(f);setSaving(false);};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)",
    display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,fontFamily:F}}
    onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
    <div style={{background:"white",borderRadius:24,width:"94%",maxWidth:560,maxHeight:"92vh",overflow:"hidden",
      boxShadow:"0 20px 60px rgba(0,0,0,0.2)",display:"flex",flexDirection:"column"}} role="dialog" aria-label="Aufgabe bearbeiten">
      <div style={{padding:"18px 22px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <h2 style={{fontSize:18,fontWeight:700,color:C.t1,margin:0}}>✏️ Aufgabe bearbeiten</h2>
        <button onClick={onCancel} tabIndex={0} aria-label="Schließen" style={{width:34,height:34,borderRadius:10,border:"none",background:C.g100,cursor:"pointer",fontSize:16,
          display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>
      <div style={{display:"flex",gap:3,padding:"10px 22px 0",overflowX:"auto"}} role="tablist">
        {[{id:"basic",l:"📋 Basis"},{id:"media",l:"🖼️ Medien"},{id:"timer",l:"⏰ Timer"},{id:"tts",l:"🔊 Sprache"}].map(t=>
          <button key={t.id} onClick={()=>setTab(t.id)} tabIndex={0} role="tab" aria-selected={tab===t.id}
            style={{padding:"7px 12px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:F,fontWeight:600,fontSize:11,
              background:tab===t.id?C.pri:C.g100,color:tab===t.id?"#fff":C.t2,whiteSpace:"nowrap",flexShrink:0}}>{t.l}</button>)}</div>
      <div style={{flex:1,overflow:"auto",padding:"14px 22px 20px"}} role="tabpanel">
        {tab==="basic"&&<>
          <label style={lbl}>Name</label>
          <input value={f.name} onChange={e=>u("name",e.target.value)} style={inp} placeholder="z.B. Zähneputzen" aria-label="Aufgabenname"/>
          <label style={lbl}>Piktogramm</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14,maxHeight:140,overflow:"auto",padding:2}}>
            {PICTOS.map(p=><button key={p.k} onClick={()=>u("icon",p.e)} title={p.n} tabIndex={0} aria-label={p.n}
              style={{width:40,height:40,borderRadius:10,fontSize:19,border:"none",cursor:"pointer",
                background:f.icon===p.e?C.pri+"22":C.g50,outline:f.icon===p.e?`2px solid ${C.pri}`:"none"}}>{p.e}</button>)}</div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}><label style={lbl}>Startzeit</label><input type="time" value={f.startTime} onChange={e=>u("startTime",e.target.value)} style={inp}/></div>
            <div style={{flex:1}}><label style={lbl}>Dauer (Min.)</label><input type="number" value={f.duration} onChange={e=>u("duration",parseInt(e.target.value)||0)} style={inp} min="1" max="480"/></div></div>
          <label style={lbl}>Farbe</label>
          <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}}>
            {TASK_COLORS.map(c=><button key={c} onClick={()=>u("color",c)} tabIndex={0} aria-label={`Farbe ${c}`}
              style={{width:32,height:32,borderRadius:"50%",background:c,border:"none",cursor:"pointer",
                outline:f.color===c?`3px solid ${C.pri}`:"2px solid #ddd",outlineOffset:2}}/>)}</div>
        </>}
        {tab==="media"&&<>
          <label style={lbl}>Bild hochladen</label>
          <MediaUp accept="image/*" label="Bild wählen" icon="📷" currentUrl={f.imageUrl} userId={userId} fileType="image"
            onFile={url=>u("imageUrl",url)}/>
          <label style={{...lbl,marginTop:6}}>Video (max. 30s)</label>
          <MediaUp accept="video/*" label="Video wählen" icon="🎬" currentUrl={f.videoUrl} userId={userId} fileType="video"
            onFile={url=>u("videoUrl",url)}/>
          <label style={{...lbl,marginTop:6}}>Sprachaufnahme</label>
          <AudioRec existingUrl={f.audioUrl} userId={userId} onRecorded={url=>u("audioUrl",url)}/>
        </>}
        {tab==="timer"&&<>
          <label style={lbl}>Erinnerungstyp</label>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[{v:"alarm",l:"🔔 Wecker",d:"Ton + Vibration"},{v:"silent",l:"🔕 Still",d:"Nur visuell"}].map(o=>
              <button key={o.v} onClick={()=>u("reminderType",o.v)} tabIndex={0}
                style={{flex:1,padding:10,borderRadius:12,border:`1.5px solid ${f.reminderType===o.v?C.pri:C.bdr}`,cursor:"pointer",
                  background:f.reminderType===o.v?C.pri+"10":"white",fontFamily:F,textAlign:"left" as const}}>
                <div style={{fontSize:14,fontWeight:700,color:f.reminderType===o.v?C.pri:C.t1}}>{o.l}</div>
                <div style={{fontSize:10,color:C.t2,marginTop:3}}>{o.d}</div></button>)}</div>
          <label style={lbl}>Verlängerung (Min.)</label>
          <input type="number" value={f.extensionMinutes||5} onChange={e=>u("extensionMinutes",parseInt(e.target.value)||5)} style={inp} min="1" max="30"/>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <button onClick={()=>u("enableMidReminders",!f.enableMidReminders)} tabIndex={0} role="switch" aria-checked={f.enableMidReminders}
              style={{width:46,height:26,borderRadius:13,border:"none",cursor:"pointer",flexShrink:0,
                background:f.enableMidReminders?C.ok:C.g300,position:"relative",transition:"background 0.2s"}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"white",position:"absolute",top:3,
                left:f.enableMidReminders?23:3,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </button><span style={{fontSize:13,fontWeight:600,color:C.t1}}>Zwischenerinnerungen (50%/80%)</span></div>
          {f.enableMidReminders&&<><label style={lbl}>Erinnerungstext</label>
            <input value={f.midReminderText||""} onChange={e=>u("midReminderText",e.target.value)} style={inp} placeholder="Bist du fast fertig?"/></>}
        </>}
        {tab==="tts"&&<>
          <label style={lbl}>Sprachausgabe-Text</label>
          <textarea value={f.ttsText||""} onChange={e=>u("ttsText",e.target.value)}
            style={{...inp,minHeight:70,resize:"vertical" as const}} placeholder="Wird beim Aufgabenstart vorgelesen..."/>
          <button onClick={testTTS} tabIndex={0} style={{padding:"10px 18px",borderRadius:12,border:"none",
            background:C.pri+"15",color:C.pri,cursor:"pointer",fontFamily:F,fontWeight:600,fontSize:13,marginBottom:14}}>🔊 Vorlesen testen</button>
          <div style={{background:C.g50,borderRadius:10,padding:12,fontSize:11,color:C.t2,lineHeight:1.5}}>
            <strong>Tipp:</strong> Der Text wird automatisch vorgelesen wenn die Aufgabe im Kind-Modus startet. 
            Zusätzlich kannst du im Medien-Tab eine eigene Aufnahme hinterlegen.</div>
        </>}
      </div>
      <div style={{padding:"14px 22px",borderTop:`1px solid ${C.bdr}`,display:"flex",gap:8}}>
        <button onClick={save} disabled={saving} tabIndex={0} style={{flex:1,padding:12,borderRadius:14,border:"none",
          background:saving?"#aaa":C.pri,color:"#fff",fontFamily:F,fontWeight:700,fontSize:14,cursor:"pointer"}}>
          {saving?"Speichern...":"💾 Speichern"}</button>
        <button onClick={onCancel} tabIndex={0} style={{padding:"12px 18px",borderRadius:14,border:`1.5px solid ${C.bdr}`,
          background:"white",color:C.t1,fontFamily:F,fontWeight:600,fontSize:13,cursor:"pointer"}}>Abbrechen</button>
        {onDelete&&<button onClick={()=>onDelete(f.id)} tabIndex={0} style={{padding:"12px 14px",borderRadius:14,
          border:`1.5px solid ${C.err}33`,background:C.err+"08",color:C.err,cursor:"pointer",fontFamily:F,fontWeight:600}}>🗑️</button>}
      </div>
    </div>
  </div>;
}

// ═══ STATS DASHBOARD ═════════════════════════════════════════
function StatsView({profileId,profileName,taskCount}:{profileId:string;profileName:string;taskCount:number}){
  const [todayStats,setTodayStats]=useState<any>(null);
  const [weekData,setWeekData]=useState<any[]>([]);
  const [allStickers,setAllStickers]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{loadStats();},[profileId]);
  const loadStats=async()=>{setLoading(true);
    try{
      const today=new Date().toISOString().split("T")[0];
      const [ts,week,stk]=await Promise.all([
        completionsApi.statsForDate(profileId,today),
        completionsApi.recentStats(profileId,7),
        stickersApi.total(profileId),
      ]);
      ts.totalTasks=taskCount;setTodayStats(ts);setWeekData(week);setAllStickers(stk);
    }catch(e){console.warn("Stats load failed:",e);}
    setLoading(false);};

  if(loading)return <div style={{textAlign:"center",padding:40}}><Spinner text="Statistik laden..."/></div>;

  const maxWeek=Math.max(...weekData.map(d=>d.completed),1);
  const fmtDate=(d:string)=>{const dt=new Date(d+"T12:00:00");return WD_LABELS[dt.getDay()];};
  const fmtSec=(s:number|null)=>s?`${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")} min`:"—";

  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:"white",borderRadius:14,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <h3 style={{fontSize:16,fontWeight:700,color:C.t1,margin:"0 0 14px"}}>📊 Heute – {profileName}</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
        {[{l:"Erledigt",v:`${todayStats?.completedTasks||0}/${taskCount}`,icon:"✅",bg:"#E8F5E9"},
          {l:"Verlängerungen",v:`${todayStats?.extensions||0}`,icon:"⏳",bg:"#FFF3E0"},
          {l:"Hilfe genutzt",v:`${todayStats?.helpUsed||0}`,icon:"🆘",bg:"#E3F2FD"},
          {l:"Sticker heute",v:`${todayStats?.stickersEarned||0}`,icon:"⭐",bg:"#FFF8E1"}].map((s,i)=>
          <div key={i} style={{background:s.bg,borderRadius:12,padding:14,textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:2}}>{s.icon}</div>
            <div style={{fontSize:20,fontWeight:700,color:C.t1}}>{s.v}</div>
            <div style={{fontSize:10,color:C.t2,marginTop:2}}>{s.l}</div></div>)}</div>
      {todayStats?.avgSeconds&&<div style={{background:C.g50,borderRadius:10,padding:10,fontSize:12,color:C.t2,textAlign:"center"}}>
        ⏱️ Durchschnittliche Dauer: <strong style={{color:C.t1}}>{fmtSec(todayStats.avgSeconds)}</strong></div>}
    </div>

    {/* Week chart */}
    <div style={{background:"white",borderRadius:14,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <h3 style={{fontSize:16,fontWeight:700,color:C.t1,margin:"0 0 14px"}}>📈 Letzte 7 Tage</h3>
      <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,marginBottom:8}}>
        {weekData.map((d,i)=>{const h=maxWeek>0?(d.completed/maxWeek)*100:0;const isToday=i===weekData.length-1;
          return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <span style={{fontSize:10,fontWeight:700,color:C.t1}}>{d.completed||""}</span>
            <div style={{width:"100%",borderRadius:6,background:isToday?`linear-gradient(180deg,${C.pri},${C.priL})`:C.g200,
              height:`${Math.max(h,4)}%`,transition:"height 0.5s ease",minHeight:4}}/>
            <span style={{fontSize:9,fontWeight:600,color:isToday?C.pri:C.t3}}>{fmtDate(d.date)}</span>
          </div>;})}
      </div>
      <div style={{display:"flex",gap:16,justifyContent:"center",fontSize:10,color:C.t2}}>
        <span>🔵 Erledigt</span>
        <span>Σ {weekData.reduce((a,d)=>a+d.completed,0)} diese Woche</span></div>
    </div>

    {/* Sticker collection */}
    {allStickers.length>0&&<div style={{background:"white",borderRadius:14,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <h3 style={{fontSize:16,fontWeight:700,color:C.t1,margin:"0 0 10px"}}>🏆 Sticker-Sammlung ({allStickers.length})</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {allStickers.slice(0,50).map((s,i)=><span key={i} style={{fontSize:24}} title={s.task_name}>{s.sticker}</span>)}</div>
      {allStickers.length>50&&<p style={{fontSize:11,color:C.t3,marginTop:8}}>...und {allStickers.length-50} weitere</p>}</div>}
  </div>;
}

// ═══ SETTINGS PANEL (persistent) ═════════════════════════════
function SettingsPanel({userId,settings,onSave}:{userId:string;settings:typeof DEFAULT_SETTINGS;onSave:(s:typeof DEFAULT_SETTINGS)=>void}){
  const [s,setS]=useState({...settings});const [saved,setSaved]=useState(false);
  const u=(k:string,v:any)=>setS((p:any)=>({...p,[k]:v}));
  const save=async()=>{try{await settingsApi.upsert(userId,s);onSave(s);setSaved(true);setTimeout(()=>setSaved(false),2000);}
    catch(e){alert("Speichern fehlgeschlagen: "+e);}};
  return <div style={{background:"white",borderRadius:14,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",maxWidth:440}}>
    <h3 style={{fontSize:16,fontWeight:700,color:C.t1,margin:"0 0 16px"}}>⚙️ Einstellungen</h3>
    <label style={lbl}>PIN (Kind-Modus Sperre)</label>
    <input type="text" inputMode="numeric" maxLength={4} value={s.pin_code} onChange={e=>u("pin_code",e.target.value.replace(/\D/g,""))}
      style={inp} placeholder="4-stellig" aria-label="PIN Code"/>
    <label style={lbl}>Standard-Verlängerung (Min.)</label>
    <input type="number" value={s.extension_minutes} onChange={e=>u("extension_minutes",parseInt(e.target.value)||5)} style={inp} min={1} max={30}/>
    <label style={lbl}>Sprachgeschwindigkeit: {s.tts_rate.toFixed(1)}</label>
    <input type="range" min="0.5" max="1.5" step="0.1" value={s.tts_rate} onChange={e=>u("tts_rate",parseFloat(e.target.value))}
      style={{width:"100%",marginBottom:14}} aria-label="TTS Geschwindigkeit"/>
    <label style={lbl}>Sprache</label>
    <select value={s.language} onChange={e=>u("language",e.target.value)} style={inp}>
      <option value="de-DE">Deutsch</option><option value="en-US">English</option></select>
    {[{k:"vibration_enabled",l:"Vibration"},{k:"sound_enabled",l:"Ton-Erinnerungen"}].map(opt=>
      <div key={opt.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0"}}>
        <span style={{fontSize:13,fontWeight:600,color:C.t1}}>{opt.l}</span>
        <button onClick={()=>u(opt.k,!(s as any)[opt.k])} tabIndex={0} role="switch" aria-checked={(s as any)[opt.k]}
          style={{width:46,height:26,borderRadius:13,border:"none",cursor:"pointer",
            background:(s as any)[opt.k]?C.ok:C.g300,position:"relative",transition:"background 0.2s"}}>
          <div style={{width:20,height:20,borderRadius:"50%",background:"white",position:"absolute",top:3,
            left:(s as any)[opt.k]?23:3,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
        </button></div>)}
    <button onClick={save} tabIndex={0} style={{width:"100%",padding:12,borderRadius:14,border:"none",marginTop:12,
      background:saved?C.ok:C.pri,color:"#fff",fontFamily:F,fontWeight:700,fontSize:14,cursor:"pointer",transition:"background 0.3s"}}>
      {saved?"✅ Gespeichert!":"💾 Einstellungen speichern"}</button>
    <div style={{marginTop:16,padding:12,background:"#E3F2FD",borderRadius:10,fontSize:12,color:C.t1,lineHeight:1.5}}>
      <strong>📱 Android-Installation:</strong> Chrome → ⋮ → „Zum Startbildschirm hinzufügen". Die App läuft dann im Vollbild.</div>
    <div style={{marginTop:8,padding:12,background:"#E8F5E9",borderRadius:10,fontSize:12,color:C.t1,lineHeight:1.5}}>
      <strong>✅ Supabase verbunden</strong> – Alle Daten werden automatisch gespeichert und sind nach Neustart verfügbar.</div>
  </div>;
}

// ═══ CHILD MODE ══════════════════════════════════════════════
function ChildMode({profile,tasks,profileId,settings,onExit}:
  {profile:{name:string;avatar:string};tasks:UITask[];profileId:string;settings:typeof DEFAULT_SETTINGS;onExit:()=>void}){
  const [ci,setCi]=useState(0);const [done,setDone]=useState(new Set<string>());
  const [rem,setRem]=useState(tasks[0]?.duration*60||0);const [tot,setTot]=useState(tasks[0]?.duration*60||0);
  const [paused,setPaused]=useState(false);const [confetti,setConfetti]=useState(false);
  const [trans,setTrans]=useState<any>(null);const [expired,setExpired]=useState(false);
  const [allDone,setAllDone]=useState(false);const [stickerList,setStickerList]=useState<string[]>([]);
  const [midShown,setMidShown]=useState({h:false,e:false});const [midMsg,setMidMsg]=useState<string|null>(null);
  const [showPin,setShowPin]=useState(false);const [extCount,setExtCount]=useState(0);const [usedHelp,setUsedHelp]=useState(false);
  const [taskStartTime,setTaskStartTime]=useState(Date.now());
  const tmr=useRef<any>(null);const videoRef=useRef<HTMLVideoElement>(null);
  const ct=tasks[ci];const nt=ci+1<tasks.length?tasks[ci+1]:null;
  const prog=tasks.length>0?done.size/tasks.length:0;

  // Timer
  useEffect(()=>{if(paused||trans||expired||allDone)return;
    tmr.current=setInterval(()=>setRem(p=>{if(p<=1){clearInterval(tmr.current);setExpired(true);
      if(settings.vibration_enabled&&"vibrate" in navigator)navigator.vibrate([200,100,200,100,200]);return 0;}return p-1;}),1000);
    return()=>clearInterval(tmr.current);},[ci,paused,trans,expired,allDone]);

  // Mid-reminders
  useEffect(()=>{if(!ct?.enableMidReminders||tot===0)return;const pct=rem/tot;
    if(pct<=0.5&&!midShown.h){setMidShown(p=>({...p,h:true}));setMidMsg(ct.midReminderText||"Bist du fast fertig?");setTimeout(()=>setMidMsg(null),3500);}
    if(pct<=0.2&&!midShown.e){setMidShown(p=>({...p,e:true}));setMidMsg("Gleich ist die Zeit um!");setTimeout(()=>setMidMsg(null),3500);}
  },[rem]);

  // TTS + video autoplay on task start
  useEffect(()=>{
    if(ct?.ttsText&&window.speechSynthesis){window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(ct.ttsText);u.lang=settings.language;u.rate=settings.tts_rate;window.speechSynthesis.speak(u);}
    // Video autoplay: start muted, then try unmuted after user gesture
    if(ct?.videoUrl&&videoRef.current){const v=videoRef.current;v.muted=true;v.play().catch(()=>{});
      // Try unmuting after short delay (works if user has interacted)
      setTimeout(()=>{try{v.muted=false;}catch{}},500);}
    setExtCount(0);setUsedHelp(false);setMidShown({h:false,e:false});setTaskStartTime(Date.now());
  },[ci]);

  // Wake Lock
  useEffect(()=>{let wl:any=null;
    if("wakeLock" in navigator)(navigator as any).wakeLock.request("screen").then((l:any)=>{wl=l;}).catch(()=>{});
    return()=>{wl?.release();};},[]);

  const goNext=useCallback(()=>{setTrans(null);
    if(ci+1<tasks.length){const nx=ci+1;setCi(nx);const d=tasks[nx].duration*60;setRem(d);setTot(d);}
    else setAllDone(true);},[ci,tasks]);

  const handleDone=async()=>{const nd=new Set(done);nd.add(ct.id);setDone(nd);
    const sticker=STICKERS[stickerList.length%STICKERS.length];setStickerList(s=>[...s,sticker]);
    setConfetti(true);clearInterval(tmr.current);
    const elapsed=Math.floor((Date.now()-taskStartTime)/1000);
    completionsApi.record({task_id:ct.id,profile_id:profileId,needed_extension:extCount>0,
      extension_count:extCount,completion_time_seconds:elapsed,used_help:usedHelp,auto_completed:false}).catch(()=>{});
    stickersApi.add(profileId,sticker,ct.name).catch(()=>{});
    setTimeout(()=>{setConfetti(false);setTrans({done:ct,next:nt});},1600);};

  const handleExtend=()=>{const ext=(ct.extensionMinutes||settings.extension_minutes||5)*60;setRem(p=>p+ext);setTot(p=>p+ext);setExtCount(c=>c+1);
    if(window.speechSynthesis){window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance("Kein Problem, du schaffst das!");u.lang=settings.language;u.rate=settings.tts_rate;window.speechSynthesis.speak(u);}};

  const handleHelp=()=>{setUsedHelp(true);
    if(ct?.audioUrl){const a=new Audio(ct.audioUrl);a.play().catch(()=>{});}
    else if(ct?.ttsText&&window.speechSynthesis){window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(ct.ttsText);u.lang=settings.language;u.rate=settings.tts_rate*0.85;window.speechSynthesis.speak(u);}};

  if(!ct)return null;

  return <div style={{position:"fixed",inset:0,background:`linear-gradient(180deg,${C.bg},#EEF2F7)`,fontFamily:F,
    display:"flex",flexDirection:"column",overflow:"hidden",touchAction:"manipulation"}}>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 16px",
      background:"rgba(255,255,255,0.88)",backdropFilter:"blur(10px)",borderBottom:`1px solid ${C.bdr}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:24}}>{profile.avatar}</span>
        <span style={{fontSize:15,fontWeight:700,color:C.t1}}>{profile.name}s Tag</span></div>
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,maxWidth:260,margin:"0 16px"}}>
        <div style={{flex:1,height:8,background:C.g200,borderRadius:4,overflow:"hidden"}} role="progressbar"
          aria-valuenow={done.size} aria-valuemax={tasks.length}>
          <div style={{height:"100%",width:`${prog*100}%`,background:`linear-gradient(90deg,${C.ok},${C.okL})`,borderRadius:4,transition:"width 0.5s"}}/></div>
        <span style={{fontSize:12,fontWeight:700,color:C.t2}}>{done.size}/{tasks.length}</span></div>
      <button onClick={()=>setShowPin(true)} tabIndex={0} style={{padding:"5px 12px",background:C.g200,border:"none",borderRadius:8,
        fontSize:11,color:C.t2,cursor:"pointer",fontFamily:F,fontWeight:600}}>🔒 Eltern</button></div>

    <div style={{padding:"5px 12px",display:"flex",justifyContent:"center"}}><Timeline tasks={tasks} ci={ci} doneSet={done}/></div>

    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px",gap:24,flexWrap:"wrap"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,minWidth:170}}>
        <div style={{width:170,height:170,borderRadius:28,background:ct.color||C.g200,display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:80,boxShadow:"0 6px 24px rgba(0,0,0,0.08)",overflow:"hidden",animation:"fadeIn 0.35s ease-out"}}>
          {ct.imageUrl?<img src={ct.imageUrl} alt={ct.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :ct.videoUrl?<video ref={videoRef} src={ct.videoUrl} autoPlay loop muted playsInline
            onClick={e=>{const v=e.currentTarget;v.muted=!v.muted;}}
            style={{width:"100%",height:"100%",objectFit:"cover",cursor:"pointer"}}/>
          :ct.icon}</div>
        <h1 style={{fontSize:30,fontWeight:700,color:C.t1,margin:0,textAlign:"center"}}>{ct.name}</h1>
        <p style={{fontSize:14,color:C.t2,margin:0}}>{ct.startTime} · {ct.duration} Min</p></div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
        <CircTimer rem={rem} total={tot} size={190}/>
        {paused&&<span style={{fontSize:14,fontWeight:600,color:C.warn}}>⏸️ Pausiert</span>}</div></div>

    {midMsg&&<div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",background:C.warn,color:"white",
      padding:"10px 22px",borderRadius:14,fontSize:17,fontWeight:600,zIndex:80,boxShadow:"0 4px 16px rgba(0,0,0,0.15)",
      fontFamily:F,whiteSpace:"nowrap"}} role="alert">{midMsg}</div>}

    <div style={{display:"flex",justifyContent:"center",gap:12,padding:"10px 16px 16px",flexWrap:"wrap"}}>
      <ABtn label="Fertig!" icon="✅" color={C.ok} onClick={handleDone} tabIndex={1}/>
      <ABtn label="Noch Zeit" icon="⏳" color={C.warn} onClick={handleExtend} tabIndex={2}/>
      <ABtn label="Hilfe" icon="🆘" color={C.pri} onClick={handleHelp} tabIndex={3}/>
      <ABtn label={paused?"Weiter":"Pause"} icon={paused?"▶️":"⏸️"} color={C.g400} onClick={()=>setPaused(!paused)} sz="sm" tabIndex={4}/></div>

    <Confetti show={confetti}/>

    {/* Transition */}
    {trans&&<div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#E8F5E9,#FFFDE7)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:100,fontFamily:F}}
      onClick={goNext} role="dialog" aria-label="Aufgabe erledigt">
      <div style={{fontSize:68,marginBottom:14,animation:"bounceIn 0.5s ease-out"}}>🎉</div>
      <h2 style={{fontSize:32,fontWeight:700,color:C.ok,marginBottom:6}}>Super gemacht!</h2>
      <p style={{fontSize:20,color:C.t2,marginBottom:28}}>„{trans.done.name}" erledigt!</p>
      {trans.next&&<div style={{background:"white",borderRadius:22,padding:"22px 36px",boxShadow:"0 4px 20px rgba(0,0,0,0.08)",
        textAlign:"center",animation:"slideUp 0.4s ease-out 0.2s both"}}>
        <p style={{fontSize:16,color:C.t2,marginBottom:6}}>Als Nächstes:</p>
        <div style={{fontSize:44,marginBottom:6}}>{trans.next.icon}</div>
        <p style={{fontSize:26,fontWeight:700,color:C.t1}}>{trans.next.name}</p></div>}
      <p style={{marginTop:24,fontSize:14,color:C.t3}}>Tippe zum Fortfahren</p></div>}

    {/* Expired */}
    {expired&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:150,fontFamily:F}} role="alertdialog">
      <div style={{background:"white",borderRadius:28,padding:"36px 44px",boxShadow:"0 16px 48px rgba(0,0,0,0.2)",textAlign:"center",maxWidth:440}}>
        <div style={{fontSize:52,marginBottom:14}}>⏰</div>
        <h2 style={{fontSize:26,fontWeight:700,color:C.t1,marginBottom:6}}>Die Zeit ist um!</h2>
        <p style={{fontSize:18,color:C.t2,marginBottom:28}}>Hast du „{ct.name}" geschafft?</p>
        <div style={{display:"flex",gap:14,justifyContent:"center"}}>
          <ABtn label="Ja, fertig!" icon="✅" color={C.ok} onClick={()=>{setExpired(false);handleDone();}}/>
          <ABtn label="Noch nicht" icon="⏳" color={C.warn} onClick={()=>{setExpired(false);setRem(3*60);setTot(p=>p+3*60);}}/></div></div></div>}

    {/* All Done */}
    {allDone&&<div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#667eea,#764ba2,#f093fb)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:200,fontFamily:F,color:"white"}}>
      <div style={{fontSize:76,marginBottom:14,animation:"bounceIn 0.6s ease-out"}}>🌟</div>
      <h1 style={{fontSize:38,fontWeight:700,marginBottom:6}}>Toll gemacht, {profile.name}!</h1>
      <p style={{fontSize:22,opacity:0.9,marginBottom:28}}>Alle {tasks.length} Aufgaben geschafft!</p>
      <div style={{background:"rgba(255,255,255,0.15)",borderRadius:22,padding:"20px 28px",backdropFilter:"blur(10px)",marginBottom:28}}>
        <p style={{fontSize:14,marginBottom:10,opacity:0.8}}>Deine Sticker:</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
          {stickerList.map((s,i)=><span key={i} style={{fontSize:32,animation:`bounceIn 0.4s ease-out ${i*0.08}s both`}}>{s}</span>)}</div></div>
      <button onClick={onExit} tabIndex={0} style={{padding:"14px 36px",background:"rgba(255,255,255,0.2)",border:"2px solid rgba(255,255,255,0.4)",
        borderRadius:14,color:"white",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:F}}>Zurück</button></div>}

    {showPin&&<PinDialog correctPin={settings.pin_code||"1234"} onOk={()=>{setShowPin(false);window.speechSynthesis?.cancel();onExit();}} onCancel={()=>setShowPin(false)}/>}
    <style>{`@keyframes fadeIn{0%{opacity:0;transform:scale(.93)}100%{opacity:1;transform:scale(1)}}
      @keyframes bounceIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
      @keyframes slideUp{0%{transform:translateY(25px);opacity:0}100%{transform:translateY(0);opacity:1}}`}</style>
  </div>;
}

// ═══ PARENT DASHBOARD ════════════════════════════════════════
function Dashboard({userId,settings,onSettings,onStartChild,onLogout}:
  {userId:string;settings:typeof DEFAULT_SETTINGS;onSettings:(s:typeof DEFAULT_SETTINGS)=>void;
   onStartChild:(p:any,t:UITask[],pid:string)=>void;onLogout:()=>void}){
  const [profileList,setProfileList]=useState<Profile[]>([]);
  const [selProfile,setSelProfile]=useState<Profile|null>(null);
  const [schedule,setSchedule]=useState<Schedule|null>(null);
  const [taskList,setTaskList]=useState<UITask[]>([]);
  const [editing,setEditing]=useState<UITask|null>(null);
  const [tab,setTab]=useState("schedule");
  const [loading,setLoading]=useState(true);
  const [newP,setNewP]=useState(false);const [newName,setNewName]=useState("");
  const [dragIdx,setDragIdx]=useState<number|null>(null);
  const listRef=useRef<HTMLDivElement>(null);const touchStartRef=useRef<any>(null);

  useEffect(()=>{loadProfiles();},[]);

  const loadProfiles=async()=>{try{const p=await profilesApi.list();setProfileList(p);
    if(p.length>0){setSelProfile(p[0]);await loadScheduleAndTasks(p[0].id);}setLoading(false);
  }catch(e){console.error("Load profiles failed:",e);setLoading(false);}};

  const loadScheduleAndTasks=async(profileId:string)=>{try{
    let scheds=await schedulesApi.list(profileId);let sched=scheds.find(s=>s.is_active);
    if(!sched)sched=await schedulesApi.create(profileId,"Mein Tagesplan",[1,2,3,4,5]);
    setSchedule(sched);const dbTasks=await tasksApi.list(sched.id);setTaskList(dbTasks.map(dbToUI));
  }catch(e){console.error("Load tasks failed:",e);setTaskList([]);}};

  const selectProfile=async(p:Profile)=>{setSelProfile(p);setLoading(true);await loadScheduleAndTasks(p.id);setLoading(false);};

  const addProfile=async()=>{if(!newName.trim())return;
    try{const p=await profilesApi.create(userId,newName.trim(),AVATARS[profileList.length%AVATARS.length]);
      setProfileList(prev=>[...prev,p]);setSelProfile(p);await loadScheduleAndTasks(p.id);setNewP(false);setNewName("");}
    catch(e){alert("Fehler beim Erstellen: "+e);}};

  const addTask=async()=>{if(!schedule)return;
    try{const nt=await tasksApi.create(schedule.id,{name:"Neue Aufgabe",start_time:"12:00",duration_minutes:10,
      sort_order:taskList.length,icon_emoji:"📌",color:"#E1BEE7",extension_minutes:settings.extension_minutes});
      const uiTask=dbToUI(nt);setTaskList(p=>[...p,uiTask]);setEditing(uiTask);
    }catch(e){alert("Fehler: "+e);}};

  const saveTask=async(t:UITask)=>{
    try{await tasksApi.update(t.id,uiToDB(t));setTaskList(p=>p.map(x=>x.id===t.id?t:x));setEditing(null);}
    catch(e){alert("Speichern fehlgeschlagen: "+e);}};

  const deleteTask=async(id:string)=>{
    try{await tasksApi.delete(id);setTaskList(p=>p.filter(x=>x.id!==id));setEditing(null);}
    catch(e){alert("Löschen fehlgeschlagen: "+e);}};

  const duplicateTask=async(t:UITask)=>{if(!schedule)return;
    try{const nt=await tasksApi.create(schedule.id,{...uiToDB(t),name:t.name+" (Kopie)",sort_order:taskList.length});
      setTaskList(p=>[...p,dbToUI(nt)]);}catch(e){alert("Kopieren fehlgeschlagen: "+e);}};

  // Weekday filter for child mode
  const startChildMode=()=>{if(!selProfile||taskList.length===0){alert("Bitte zuerst Aufgaben hinzufügen.");return;}
    const todayDow=new Date().getDay();const schedDays=schedule?.days_of_week||[];
    if(schedDays.length>0&&!schedDays.includes(todayDow)){
      const todayLabel=WD_LABELS[todayDow];
      if(!confirm(`Heute ist ${todayLabel} – dieser Plan ist nicht für ${todayLabel} konfiguriert. Trotzdem starten?`))return;}
    const idx=profileList.indexOf(selProfile);
    onStartChild({name:selProfile.name,avatar:getAvatar(selProfile,idx)},taskList,selProfile.id);};

  // Mouse DnD
  const onDragStart=(i:number)=>setDragIdx(i);
  const onDragOver=(e:React.DragEvent,i:number)=>{e.preventDefault();if(dragIdx===null||dragIdx===i)return;
    const u=[...taskList];const[m]=u.splice(dragIdx,1);u.splice(i,0,m);setTaskList(u);setDragIdx(i);};
  const onDragEnd=async()=>{setDragIdx(null);const r=taskList.map((t,i)=>({id:t.id,sort_order:i}));
    tasksApi.reorder(r).catch(e=>console.warn("Reorder failed:",e));};

  // Touch DnD
  const handleTouchStart=(e:React.TouchEvent,idx:number)=>{touchStartRef.current={idx,y:e.touches[0].clientY,moved:false};};
  const handleTouchMove=(e:React.TouchEvent)=>{if(!touchStartRef.current)return;
    const dy=Math.abs(e.touches[0].clientY-touchStartRef.current.y);if(dy>10)touchStartRef.current.moved=true;
    if(!touchStartRef.current.moved)return;const touch=e.touches[0];const items=listRef.current?.children;
    if(!items)return;for(let i=0;i<items.length;i++){const rect=items[i].getBoundingClientRect();
      if(touch.clientY>=rect.top&&touch.clientY<=rect.bottom&&i!==touchStartRef.current.idx){
        const u=[...taskList];const[m]=u.splice(touchStartRef.current.idx,1);u.splice(i,0,m);
        setTaskList(u);touchStartRef.current.idx=i;break;}}};
  const handleTouchEnd=(idx:number)=>{
    if(touchStartRef.current&&!touchStartRef.current.moved)setEditing(taskList[idx]);
    else{const r=taskList.map((t,i)=>({id:t.id,sort_order:i}));tasksApi.reorder(r).catch(()=>{});}
    touchStartRef.current=null;};

  if(loading)return <Spinner text="Daten werden geladen..."/>;

  const todayDow=new Date().getDay();const todayLabel=WD_LABELS[todayDow];
  const schedActiveToday=schedule?.days_of_week?.includes(todayDow);

  return <div style={{height:"100%",overflow:"auto",background:C.bg,fontFamily:F}}>
    <nav style={{background:"white",borderBottom:`1px solid ${C.bdr}`,padding:"8px 20px",display:"flex",alignItems:"center",
      justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:24}}>📋</span>
        <h1 style={{fontSize:18,fontWeight:700,color:C.t1,margin:0}}>DayGuide</h1>
        <span style={{fontSize:9,fontWeight:700,background:C.pri+"15",color:C.pri,padding:"2px 8px",borderRadius:6}}>Eltern</span></div>
      <div style={{display:"flex",alignItems:"center",gap:4,overflowX:"auto"}}>
        {profileList.map((p,idx)=><button key={p.id} onClick={()=>selectProfile(p)} tabIndex={0}
          style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:9,border:"none",cursor:"pointer",
            background:selProfile?.id===p.id?C.pri+"15":"transparent",fontFamily:F,fontWeight:600,fontSize:12,
            color:selProfile?.id===p.id?C.pri:C.t2,whiteSpace:"nowrap",flexShrink:0}}>
          <span style={{fontSize:18}}>{getAvatar(p,idx)}</span>{p.name}</button>)}
        <button onClick={()=>setNewP(true)} tabIndex={0} aria-label="Profil hinzufügen"
          style={{width:32,height:32,borderRadius:8,border:`1.5px dashed ${C.bdr}`,background:"transparent",
            cursor:"pointer",fontSize:14,color:C.t3,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
        <button onClick={onLogout} tabIndex={0} style={{padding:"5px 10px",borderRadius:8,border:"none",background:C.g100,
          fontSize:11,color:C.t2,cursor:"pointer",fontFamily:F,fontWeight:600,marginLeft:8}}>Abmelden</button></div>
    </nav>

    {newP&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(3px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:600}} onClick={e=>{if(e.target===e.currentTarget)setNewP(false);}}>
      <div style={{background:"white",borderRadius:20,padding:28,width:320,boxShadow:"0 16px 48px rgba(0,0,0,0.15)"}}>
        <h3 style={{fontSize:16,fontWeight:700,color:C.t1,margin:"0 0 14px"}}>👤 Neues Profil</h3>
        <label style={lbl}>Name des Kindes</label>
        <input value={newName} onChange={e=>setNewName(e.target.value)} style={inp} placeholder="Name" autoFocus
          onKeyDown={e=>{if(e.key==="Enter")addProfile();}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={addProfile} tabIndex={0} style={{flex:1,padding:11,borderRadius:12,border:"none",background:C.pri,color:"#fff",fontFamily:F,fontWeight:700,cursor:"pointer"}}>Erstellen</button>
          <button onClick={()=>setNewP(false)} tabIndex={0} style={{padding:"11px 18px",borderRadius:12,border:`1.5px solid ${C.bdr}`,background:"white",color:C.t1,fontFamily:F,fontWeight:600,cursor:"pointer"}}>Abbrechen</button></div></div></div>}

    {profileList.length===0?<div style={{textAlign:"center",padding:60,fontFamily:F}}>
      <div style={{fontSize:64,marginBottom:16}}>👶</div>
      <h2 style={{fontSize:22,fontWeight:700,color:C.t1,marginBottom:8}}>Willkommen bei DayGuide!</h2>
      <p style={{fontSize:15,color:C.t2,marginBottom:24}}>Erstelle zuerst ein Profil für dein Kind.</p>
      <button onClick={()=>setNewP(true)} tabIndex={0} style={{padding:"14px 28px",borderRadius:14,border:"none",
        background:C.pri,color:"#fff",fontFamily:F,fontWeight:700,fontSize:16,cursor:"pointer"}}>+ Profil erstellen</button></div>
    :<>
    <div style={{padding:"10px 20px 0",display:"flex",gap:4,overflowX:"auto",alignItems:"center"}}>
      {[{id:"schedule",l:"📅 Tagesplan"},{id:"stats",l:"📊 Statistik"},{id:"media",l:"🖼️ Medien"},{id:"settings",l:"⚙️ Einstellungen"}].map(t=>
        <button key={t.id} onClick={()=>setTab(t.id)} tabIndex={0}
          style={{padding:"8px 14px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:F,fontWeight:600,fontSize:12,
            background:tab===t.id?C.pri:"white",color:tab===t.id?"#fff":C.t2,
            boxShadow:tab===t.id?`0 2px 6px ${C.pri}33`:"0 1px 2px rgba(0,0,0,0.04)",whiteSpace:"nowrap",flexShrink:0}}>{t.l}</button>)}
      <div style={{flex:1}}/>
      <button onClick={startChildMode} tabIndex={0}
        style={{padding:"8px 18px",borderRadius:9,border:"none",cursor:"pointer",
          background:`linear-gradient(135deg,${C.ok},${C.okL})`,color:"white",fontFamily:F,fontWeight:700,fontSize:13,
          boxShadow:`0 3px 10px ${C.ok}44`,whiteSpace:"nowrap",flexShrink:0,position:"relative"}}>
        ▶️ Kind-Modus
        {schedActiveToday&&<span style={{position:"absolute",top:-4,right:-4,width:10,height:10,borderRadius:"50%",
          background:C.ok,border:"2px solid white"}}/>}
      </button></div>

    <div style={{padding:"14px 20px 80px"}}>
      {tab==="schedule"&&<>
        <div style={{background:"white",borderRadius:14,padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",marginBottom:14,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={{fontSize:16,fontWeight:700,color:C.t1,margin:"0 0 6px"}}>
              {selProfile&&getAvatar(selProfile,profileList.indexOf(selProfile))} {selProfile?.name}s Plan
              {schedule&&<span style={{fontSize:11,color:C.t3,fontWeight:500}}> · {schedule.name}</span>}</h2>
            {schedule&&<div style={{display:"flex",gap:4}}>
              {WD_DISPLAY.map((d,i)=>{const jsDow=WD_MAP[i];const active=schedule.days_of_week?.includes(jsDow);const isToday=jsDow===todayDow;
                return <button key={d} onClick={async()=>{
                  const newDays=active?schedule.days_of_week.filter(x=>x!==jsDow):[...schedule.days_of_week,jsDow];
                  const updated=await schedulesApi.update(schedule.id,{days_of_week:newDays});setSchedule(updated);}} tabIndex={0}
                  style={{width:30,height:30,borderRadius:"50%",border:isToday?`2px solid ${C.pri}`:"none",cursor:"pointer",
                    fontSize:10,fontWeight:700,fontFamily:F,background:active?C.pri:C.g100,color:active?"white":C.t2}}>{d}</button>;})}</div>}
            {!schedActiveToday&&schedule&&<p style={{fontSize:10,color:C.warn,fontWeight:600,marginTop:4}}>
              ⚠️ Dieser Plan ist nicht für {todayLabel} aktiv</p>}
          </div>
          <button onClick={addTask} tabIndex={0} style={{padding:"8px 14px",borderRadius:9,border:`1.5px dashed ${C.pri}44`,
            background:C.pri+"08",cursor:"pointer",fontFamily:F,fontWeight:600,fontSize:12,color:C.pri}}>+ Aufgabe</button></div>

        <div ref={listRef} style={{display:"flex",flexDirection:"column",gap:5}}>
          {taskList.map((t,idx)=><div key={t.id} draggable
            onDragStart={()=>onDragStart(idx)} onDragOver={e=>onDragOver(e,idx)} onDragEnd={onDragEnd}
            onTouchStart={e=>handleTouchStart(e,idx)} onTouchMove={handleTouchMove} onTouchEnd={()=>handleTouchEnd(idx)}
            onClick={()=>setEditing(t)} tabIndex={0} role="button" aria-label={`${t.name} bearbeiten`}
            onKeyDown={e=>{if(e.key==="Enter")setEditing(t);}}
            style={{background:"white",borderRadius:13,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,
              boxShadow:dragIdx===idx?"0 4px 16px rgba(0,0,0,0.1)":"0 1px 3px rgba(0,0,0,0.03)",cursor:"pointer",
              border:`1px solid ${C.bdr}`,transform:dragIdx===idx?"scale(1.02)":"scale(1)",transition:"all 0.1s",outline:"none"}}>
            <div style={{cursor:"grab",color:C.t3,fontSize:14,userSelect:"none"}}>⠿</div>
            <div style={{width:42,height:42,borderRadius:11,background:t.color||C.g200,display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:22,flexShrink:0,overflow:"hidden"}}>
              {t.imageUrl?<img src={t.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:11}}/>:t.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:C.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
              <div style={{fontSize:11,color:C.t2,marginTop:1}}>
                {t.startTime} · {t.duration}min{t.reminderType==="alarm"?" 🔔":""}{t.audioUrl?" 🎤":""}{t.videoUrl?" 🎬":""}{t.imageUrl?" 📷":""}</div></div>
            <button onClick={e=>{e.stopPropagation();duplicateTask(t);}} tabIndex={0} aria-label="Aufgabe kopieren"
              style={{width:32,height:32,borderRadius:8,border:"none",background:C.g50,cursor:"pointer",fontSize:14,
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>📋</button></div>)}
        </div>
        {taskList.length===0&&<div style={{textAlign:"center",padding:40,color:C.t3}}>
          <div style={{fontSize:48,marginBottom:10}}>📝</div><p>Noch keine Aufgaben. Tippe auf „+ Aufgabe".</p></div>}
      </>}

      {tab==="stats"&&selProfile&&<StatsView profileId={selProfile.id} profileName={selProfile.name} taskCount={taskList.length}/>}

      {tab==="media"&&<div style={{background:"white",borderRadius:14,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
        <h3 style={{fontSize:16,fontWeight:700,color:C.t1,margin:"0 0 14px"}}>🖼️ Piktogramm-Bibliothek</h3>
        <p style={{fontSize:12,color:C.t2,marginBottom:14}}>Wähle ein Piktogramm beim Bearbeiten einer Aufgabe im Tab „Basis".</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:8}}>
          {PICTOS.map(p=><div key={p.k} style={{background:C.g50,borderRadius:12,padding:"14px 6px",
            display:"flex",flexDirection:"column",alignItems:"center",gap:4,border:`1px solid ${C.bdr}`}}>
            <span style={{fontSize:28}}>{p.e}</span>
            <span style={{fontSize:10,fontWeight:600,color:C.t2,textAlign:"center"}}>{p.n}</span></div>)}</div>
        <div style={{marginTop:16,padding:12,background:C.g50,borderRadius:10,fontSize:12,color:C.t2,lineHeight:1.5}}>
          <strong>Eigene Medien:</strong> Bilder, Videos und Tonaufnahmen werden pro Aufgabe im Task-Editor (Tab „Medien") hochgeladen 
          und in Supabase Storage gespeichert. Sie bleiben auch nach Neustart erhalten.</div></div>}

      {tab==="settings"&&<SettingsPanel userId={userId} settings={settings} onSave={onSettings}/>}
    </div>
    </>}
    {editing&&<TaskEditor task={editing} onSave={saveTask} onCancel={()=>setEditing(null)} onDelete={deleteTask} userId={userId}/>}
  </div>;
}

// ═══ LOGIN ═══════════════════════════════════════════════════
function Login({onAuth}:{onAuth:(userId:string)=>void}){
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");
  const [mode,setMode]=useState("login");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const handleSubmit=async()=>{if(!email||!pass){setError("Bitte E-Mail und Passwort eingeben.");return;}
    setLoading(true);setError("");
    try{if(mode==="login"){const d=await auth.signIn(email,pass);onAuth(d.user!.id);}
      else{const d=await auth.signUp(email,pass);if(d.user)onAuth(d.user.id);
        else setError("Registrierung erfolgreich! Bitte bestätige deine E-Mail.");}}
    catch(e:any){setError(e.message||"Fehler bei der Anmeldung");}setLoading(false);};
  return <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#E3F2FD 0%,#F3E5F5 40%,#FFF3E0 100%)",
    display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,padding:20}}>
    <div style={{background:"white",borderRadius:28,padding:"40px 36px",boxShadow:"0 16px 48px rgba(0,0,0,0.08)",maxWidth:400,width:"100%",textAlign:"center"}}>
      <div style={{fontSize:52,marginBottom:10}}>📋</div>
      <h1 style={{fontSize:28,fontWeight:700,color:C.t1,marginBottom:2}}>DayGuide</h1>
      <p style={{fontSize:14,color:C.t2,marginBottom:24,lineHeight:1.4}}>Visuelle Tagesstruktur<br/>für Kinder &amp; Jugendliche</p>
      <div style={{display:"flex",gap:3,marginBottom:18,background:C.g50,borderRadius:9,padding:3}} role="tablist">
        {[{id:"login",l:"Anmelden"},{id:"register",l:"Registrieren"}].map(m=>
          <button key={m.id} onClick={()=>{setMode(m.id);setError("");}} tabIndex={0} role="tab" aria-selected={mode===m.id}
            style={{flex:1,padding:7,borderRadius:7,border:"none",background:mode===m.id?"white":"transparent",
              color:mode===m.id?C.t1:C.t2,fontFamily:F,fontWeight:600,fontSize:12,cursor:"pointer",
              boxShadow:mode===m.id?"0 1px 3px rgba(0,0,0,0.06)":"none"}}>{m.l}</button>)}</div>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-Mail" style={{...inp,textAlign:"center"}}
        onKeyDown={e=>{if(e.key==="Enter")handleSubmit();}} aria-label="E-Mail"/>
      <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Passwort (min. 6 Zeichen)"
        style={{...inp,textAlign:"center"}} onKeyDown={e=>{if(e.key==="Enter")handleSubmit();}} aria-label="Passwort"/>
      {error&&<p style={{color:C.err,fontSize:13,fontWeight:600,marginBottom:12}} role="alert">{error}</p>}
      <button onClick={handleSubmit} disabled={loading} tabIndex={0} style={{width:"100%",padding:13,borderRadius:14,border:"none",fontSize:15,fontWeight:700,
        cursor:loading?"wait":"pointer",fontFamily:F,background:loading?"#aaa":`linear-gradient(135deg,${C.pri},${C.priL})`,color:"white",
        boxShadow:`0 4px 14px ${C.pri}33`}}>{loading?"Bitte warten...":mode==="login"?"Anmelden":"Registrieren"}</button>
      <div style={{marginTop:20,padding:12,background:C.g50,borderRadius:10,fontSize:11,color:C.t2,lineHeight:1.5,textAlign:"left"}}>
        <strong>ℹ️ DayGuide</strong> basiert auf dem TEACCH-Ansatz für visuell strukturierte Tagespläne. 
        Registriere dich mit E-Mail und Passwort (min. 6 Zeichen).</div></div></div>;
}

// ═══ MAIN APP ════════════════════════════════════════════════
export default function DayGuide(){
  const [screen,setScreen]=useState<"loading"|"login"|"dash"|"child">("loading");
  const [userId,setUserId]=useState<string|null>(null);
  const [childProfile,setChildProfile]=useState<any>(null);
  const [childTasks,setChildTasks]=useState<UITask[]>([]);
  const [childProfileId,setChildProfileId]=useState("");
  const [appSettings,setAppSettings]=useState(DEFAULT_SETTINGS);

  useEffect(()=>{
    auth.getSession().then(async session=>{
      if(session?.user){setUserId(session.user.id);await loadSettings();setScreen("dash");}
      else setScreen("login");}).catch(()=>setScreen("login"));
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      if(session?.user){setUserId(session.user.id);setScreen(prev=>prev==="login"?"dash":prev);}
      else{setUserId(null);setScreen("login");}});
    return()=>subscription.unsubscribe();
  },[]);

  const loadSettings=async()=>{try{const s=await settingsApi.get();
    if(s)setAppSettings({...DEFAULT_SETTINGS,...s});}catch{}};

  const handleAuth=async(uid:string)=>{setUserId(uid);await loadSettings();setScreen("dash");};
  const handleLogout=async()=>{await auth.signOut();setUserId(null);setScreen("login");};
  const startChild=(p:any,t:UITask[],pid:string)=>{setChildProfile(p);setChildTasks(t);setChildProfileId(pid);setScreen("child");
    document.documentElement.requestFullscreen?.().catch(()=>{});};
  const exitChild=()=>{setScreen("dash");setChildProfile(null);window.speechSynthesis?.cancel();
    document.exitFullscreen?.().catch(()=>{});};

  return <>
    <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <style>{`*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
      html,body,#root{height:100%;overflow:hidden;overscroll-behavior:none}
      ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}
      input,select,textarea,button{font-family:'Quicksand',sans-serif}
      button:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:2px solid #4A90D9;outline-offset:2px}`}</style>
    {screen==="loading"&&<Spinner text="DayGuide wird geladen..."/>}
    {screen==="login"&&<Login onAuth={handleAuth}/>}
    {screen==="dash"&&userId&&<Dashboard userId={userId} settings={appSettings} onSettings={setAppSettings}
      onStartChild={startChild} onLogout={handleLogout}/>}
    {screen==="child"&&childProfile&&<ChildMode profile={childProfile} tasks={childTasks} profileId={childProfileId}
      settings={appSettings} onExit={exitChild}/>}
  </>;
}
