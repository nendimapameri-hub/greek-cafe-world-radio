/* Greek Café World Radio — external native browser streams, no audio resynthesis */
(() => {
 "use strict";
 const stations=window.GREEK_CAFE_STATIONS||[],groups=window.GREEK_CAFE_GROUPS||["Alle"];
 const $=id=>document.getElementById(id);
 const ui={list:$("stations"),filters:$("filters"),empty:$("empty"),search:$("search"),title:$("now-title"),sub:$("now-sub"),state:$("play-state"),status:$("stream-status"),quality:$("quality-note"),play:$("btn-play"),prev:$("btn-prev"),next:$("btn-next"),volume:$("volume"),volumeLabel:$("volume-label"),room:$("room"),canvas:$("visualizer"),connection:$("connection")};
 const prefix="greekCafeWorldRadio.v1.";
 const load=(key,fallback)=>{try{return localStorage.getItem(prefix+key)??fallback}catch{return fallback}};
 const save=(key,val)=>{try{localStorage.setItem(prefix+key,String(val))}catch{}};
 const queryParam=new URLSearchParams(location.search);
 let group="Alle",search="",selected=stations.find(x=>x.id===queryParam.get("station"))||stations.find(x=>x.id===load("station",""))||stations[0];
 let audio=null,context=null,analyser=null,wet=null,timeout=null,run=0,isPlaying=false,pending=false;
 const canvas=ui.canvas.getContext("2d",{alpha:false});
 function state(msg,type="normal"){
  ui.status.textContent=msg;
  ui.state.textContent=type==="error"?"FEHLER":type==="loading"?"VERBINDET":isPlaying?"● ON AIR":"BEREIT";
  ui.state.className="state"+(type==="error"?" error":type==="loading"?" loading":"");
  ui.connection.textContent=isPlaying?"● ON AIR":"● LIVE RADIO";
  ui.play.textContent=isPlaying?"Ⅱ":"▶";
  ui.play.setAttribute("aria-label",isPlaying?"Pause":"Wiedergabe starten");
  document.querySelector(".vinyl")?.classList.toggle("spinning",isPlaying);
 }
 function updateSelection(){
  if(!selected)return;
  ui.title.textContent=selected.name;
  ui.sub.textContent=selected.category+" · "+selected.quality+(selected.commercialFree?" · werbearm":"");
  save("station",selected.id);
  if(history.replaceState){const url=new URL(location.href);url.searchParams.set("station",selected.id);history.replaceState({}, "",url.pathname+url.search+url.hash);}
  render();
 }
 function renderFilters(){
  ui.filters.replaceChildren();
  for(const g of groups){
   const b=document.createElement("button");b.type="button";b.className="filter"+(group===g?" active":"");b.textContent=g;
   b.setAttribute("aria-pressed",String(group===g));
   b.onclick=()=>{group=g;renderFilters();render()};
   ui.filters.appendChild(b);
  }
 }
 function render(){
  const found=stations.filter(s=>(group==="Alle"||s.category===group)&&
   (s.name+" "+s.category+" "+s.label).toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de")));
  ui.empty.hidden=found.length!==0;ui.list.replaceChildren();
  const fragment=document.createDocumentFragment();
  for(const s of found){
   const b=document.createElement("button");b.type="button";b.className="station"+(s.id===selected?.id?" active":"");
   b.setAttribute("aria-pressed",String(s.id===selected?.id));
   b.innerHTML='<span class="station-icon"></span><span class="station-text"><span class="station-name"></span><span class="station-meta"></span></span><span class="station-play">▶</span>';
   b.querySelector(".station-icon").textContent=s.icon;
   b.querySelector(".station-name").textContent=s.name;
   b.querySelector(".station-meta").textContent=s.label+" · "+s.quality;
   b.addEventListener("click",()=>choose(s,true));fragment.appendChild(b);
  }
  ui.list.appendChild(fragment);
 }
 function cleanup(){
  clearTimeout(timeout);timeout=null;
  if(audio){audio.onplaying=audio.onwaiting=audio.onerror=audio.onstalled=audio.onpause=audio.onended=null;
   try{audio.pause();audio.removeAttribute("src");audio.load()}catch{} audio=null;}
  if(context){const c=context;context=null;analyser=null;wet=null;c.close().catch(()=>{});}
  isPlaying=false;pending=false;
 }
 function choose(s,autoplay=false){
  ++run;cleanup();selected=s;updateSelection();state("Ausgewählt. ▶ zum Starten.");
  if(autoplay)play(s,run);
 }
 async function corsAvailable(url){
  if(!ui.room.checked||!(window.AudioContext||window.webkitAudioContext))return false;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),1300);
  try{
   const res=await fetch(url,{method:"HEAD",mode:"cors",redirect:"follow",signal:controller.signal,cache:"no-store"});
   return res.ok;
  }catch{return false}
  finally{clearTimeout(timer)}
 }
 function attachEffects(a){
  try{
   const AC=window.AudioContext||window.webkitAudioContext;
   context=new AC();
   const src=context.createMediaElementSource(a);
   analyser=context.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.77;
   const dry=context.createGain();dry.gain.value=1;
   src.connect(analyser);analyser.connect(dry);dry.connect(context.destination);
   const delay=context.createDelay(.2);delay.delayTime.value=.042;
   const filter=context.createBiquadFilter();filter.type="lowpass";filter.frequency.value=2700;
   wet=context.createGain();wet.gain.value=ui.room.checked?.035:0;
   src.connect(delay);delay.connect(filter);filter.connect(wet);wet.connect(context.destination);
   context.resume().catch(()=>{});
   ui.quality.textContent="Originalstream Stereo · spektrale Beats · sehr dezenter Raumhall.";
  }catch{
   analyser=null;wet=null;
   ui.quality.textContent="Originalstream direkt vom Sender; für diesen Stream sind keine Audioeffekte verfügbar.";
  }
 }
 async function play(s=selected,token=++run){
  if(!s?.stream)return;
  cleanup();selected=s;updateSelection();pending=true;state("Verbinde direkt mit dem Sender …","loading");
  const cors=await corsAvailable(s.stream);
  if(run!==token)return;
  const a=document.createElement("audio");a.preload="none";a.playsInline=true;a.volume=Number(ui.volume.value)/100;
  if(cors)a.crossOrigin="anonymous";
  audio=a;
  if(cors)attachEffects(a);
  else{analyser=null;ui.quality.textContent="Unveränderter Originalstream. Raumhall nur bei CORS-fähigen Sendern möglich.";}
  a.onplaying=()=>{
   if(run!==token)return;
   pending=false;isPlaying=true;clearTimeout(timeout);
   state("LIVE · "+s.name+(analyser?" · Raumklang aktiv":" · Originalton"));
   if("mediaSession" in navigator){
    navigator.mediaSession.metadata=new MediaMetadata({title:s.name,artist:s.category,album:"Greek Café World Radio"});
    navigator.mediaSession.playbackState="playing";
   }
  };
  a.onwaiting=a.onstalled=()=>{if(run===token&&isPlaying)state("Empfang puffert …","loading")};
  a.onerror=()=>{if(run!==token)return;pending=false;isPlaying=false;clearTimeout(timeout);state("Sender nicht erreichbar. Anderen Sender wählen oder später erneut starten.","error");};
  a.onpause=()=>{if(run!==token)return;isPlaying=false;if(!pending)state("Pausiert");};
  a.onended=()=>{if(run===token){isPlaying=false;state("Senderverbindung beendet. ▶ für Neustart.","error")}};
  a.src=s.stream;
  timeout=setTimeout(()=>{if(run===token&&!isPlaying){pending=false;state("Verbindung dauert sehr lange – bitte anderen Sender testen.","error")}},15000);
  try{await a.play();}
  catch(err){if(run!==token)return;clearTimeout(timeout);pending=false;isPlaying=false;
   state(err?.name==="NotAllowedError"?"Zum Abspielen erneut ▶ drücken.":"Wiedergabe gescheitert – Sender oder Netzwerk prüfen.","error");
  }
 }
 function toggle(){
  if(audio&&isPlaying){audio.pause();isPlaying=false;state("Pausiert");if(navigator.mediaSession)navigator.mediaSession.playbackState="paused";}
  else if(audio&&audio.readyState>=2&&!pending){audio.play().catch(()=>{++run;play(selected,run)})}
  else{++run;play(selected,run)}
 }
 function next(by){
  const ix=stations.findIndex(s=>s.id===selected?.id);
  choose(stations[(ix+by+stations.length)%stations.length],true);
 }
 ui.play.onclick=toggle;ui.prev.onclick=()=>next(-1);ui.next.onclick=()=>next(1);
 ui.search.oninput=()=>{search=ui.search.value.trim();render()};
 ui.volume.value=load("volume","72");ui.volumeLabel.textContent=ui.volume.value+"%";
 ui.volume.oninput=()=>{if(audio)audio.volume=Number(ui.volume.value)/100;ui.volumeLabel.textContent=ui.volume.value+"%";save("volume",ui.volume.value)};
 ui.room.checked=load("room","true")==="true";
 ui.room.onchange=()=>{if(wet)wet.gain.setTargetAtTime(ui.room.checked?.035:0,context.currentTime,.04);save("room",ui.room.checked)};
 if(navigator.mediaSession){
  navigator.mediaSession.setActionHandler("play",()=>{if(!isPlaying)toggle()});
  navigator.mediaSession.setActionHandler("pause",()=>{if(isPlaying)toggle()});
  navigator.mediaSession.setActionHandler("nexttrack",()=>next(1));
  navigator.mediaSession.setActionHandler("previoustrack",()=>next(-1));
 }
 function paint(ts){
  const rect=ui.canvas.getBoundingClientRect();
  const w=Math.max(300,Math.round(rect.width*Math.min(2,window.devicePixelRatio||1))),h=Math.max(60,Math.round(rect.height*Math.min(2,window.devicePixelRatio||1)));
  if(ui.canvas.width!==w||ui.canvas.height!==h){ui.canvas.width=w;ui.canvas.height=h}
  canvas.fillStyle="#122439";canvas.fillRect(0,0,w,h);
  let data=null;if(analyser&&isPlaying){data=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(data);}
  const bars=68,space=w/bars;
  for(let i=0;i<bars;i++){
   let amp=.034;
   if(data){
    const ix=Math.min(data.length-1,Math.floor((i/bars)**1.36*data.length*.75));
    amp=.04+.88*data[ix]/255;
   }else if(isPlaying)amp=.14+.24*Math.abs(Math.sin(ts/420+i*.39)*Math.cos(ts/680-i*.10));
   const height=Math.max(2,amp*h*.85),x=(i+.1)*space;
   const gradient=canvas.createLinearGradient(0,h,0,h-height);
   gradient.addColorStop(0,"#3786a7");gradient.addColorStop(.55,"#78d4df");gradient.addColorStop(1,"#f0c797");
   canvas.fillStyle=gradient;canvas.fillRect(x,h-height-5,Math.max(1.5,space*.67),height);
  }
  requestAnimationFrame(paint);
 }
 renderFilters();updateSelection();
 state("Bereit. ▶ drücken – du hörst den Originalstream.");
 requestAnimationFrame(paint);
 if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();
