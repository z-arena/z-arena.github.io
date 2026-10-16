import {leaderboard,evidence,benchmark,methods,metricPage,notFound,selectedAttempt} from './view.mjs?v=2026-10-16-beta.8';
import {replaySteps} from './replay.mjs?v=2026-10-16-beta.8';
const main=document.querySelector('main');
const filters={type:'all',history:false,query:'',hosts:5};
let data,detailTab='step',timer=null;
const playback={position:1,playing:false,speed:1,host:null,source:'agent'};
const route=()=>location.hash.replace(/^#\/?/,'').split('/');
function currentAttempt(){const [,id,attempt]=route();return data?selectedAttempt(data,id,attempt):null;}
function stepCount(){const replay=currentAttempt()?.replay;return replay?replaySteps(replay,playback.source).length:0;}
function stop(){clearInterval(timer);timer=null;playback.playing=false;}
function start(){
  const total=stepCount();
  if(!total)return;
  if(playback.position>=total)playback.position=0;
  stop();playback.playing=true;
  timer=setInterval(()=>{playback.position=Math.min(total,playback.position+1);if(playback.position>=total)stop();paintReplay();},1000/playback.speed);
}
function render({focus=false}={}){
  const [raw,id,attempt]=route(),page=raw||'leaderboard';
  const active=document.activeElement;
  const restore=active?.id?'#'+active.id:active?.hasAttribute('data-play')?'[data-play]':null;
  const views={leaderboard:()=>leaderboard(data,filters),benchmark:()=>id?evidence(data,id,attempt,detailTab,playback):benchmark(data),evidence:()=>evidence(data,id,attempt,detailTab,playback),methods,metric:metricPage};
  main.innerHTML=Object.hasOwn(views,page)?views[page]():notFound();
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===(page==='evidence'||page==='benchmark'&&id?'leaderboard':page))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=`${page==='evidence'||page==='benchmark'&&id?data.configs.find(c=>c.id===id)?.name||'Benchmark':page.charAt(0).toUpperCase()+page.slice(1)} — Z-Arena`;
  if(focus){main.focus();window.scrollTo(0,0);}else if(restore)main.querySelector(restore)?.focus({preventScroll:true});
}
function paintReplay(){
  const [,id,attempt]=route(),template=document.createElement('template');
  template.innerHTML=evidence(data,id,attempt,detailTab,playback);
  const fresh=template.content;
  main.querySelector('.live-map')?.replaceWith(fresh.querySelector('.live-map'));
  const services=main.querySelector('.host-services'),nextServices=fresh.querySelector('.host-services');
  if(services&&nextServices)services.replaceWith(nextServices);
  else if(services)services.remove();
  else if(nextServices)main.querySelector('.replay-map').append(nextServices);
  main.querySelector('.map-step').textContent=fresh.querySelector('.map-step').textContent;
  for(const selector of ['.map-summary','.map-feedback'])main.querySelector(selector).replaceWith(fresh.querySelector(selector));
  main.querySelector('.replay-panel-body').innerHTML=fresh.querySelector('.replay-panel-body').innerHTML;
  const oldControls=main.querySelector('.replay-transport');
  [...fresh.querySelector('.replay-transport').children].forEach((next,i)=>{
    const old=oldControls.children[i];
    for(const attr of [...old.attributes])if(!next.hasAttribute(attr.name))old.removeAttribute(attr.name);
    for(const attr of next.attributes)old.setAttribute(attr.name,attr.value);
    if(old.tagName==='INPUT')old.value=String(playback.position);
    else if(old.tagName==='SELECT')old.value=String(playback.speed);
    else if(old.innerHTML!==next.innerHTML)old.innerHTML=next.innerHTML;
  });
  const buttons=main.querySelectorAll('.step-strip button');
  fresh.querySelectorAll('.step-strip button').forEach((next,i)=>{
    for(const attr of next.attributes)buttons[i].setAttribute(attr.name,attr.value);
  });
}
function seek(value){
  stop();const total=stepCount();
  playback.position=Math.max(0,Math.min(total,Number(value)||0));paintReplay();
}
document.addEventListener('click',event=>{
  if(event.target.closest('.skip')){event.preventDefault();main.focus();return;}
  const verification=event.target.closest('[data-verification-step]');
  const mode=event.target.closest('[data-replay-source]');
  if(verification||mode){stop();Object.assign(playback,{source:verification?'verification':mode.dataset.replaySource,position:verification?Number(verification.dataset.verificationStep):1,host:null});detailTab='step';render();return;}
  const step=event.target.closest('[data-seek]');if(step){seek(step.dataset.seek);return;}
  if(event.target.closest('[data-play]')){if(playback.playing)stop();else start();paintReplay();return;}
  const host=event.target.closest('[data-host]');if(host){playback.host=playback.host===host.dataset.host?null:host.dataset.host;render();return;}
  const detail=event.target.closest('[data-detail-tab]');if(detail){detailTab=detail.dataset.detailTab;render();main.querySelector(`[data-detail-tab="${detailTab}"]`)?.focus({preventScroll:true});return;}
  const scenario=event.target.closest('[data-hosts]');if(scenario){filters.hosts=Number(scenario.dataset.hosts);render();main.querySelector(`[data-hosts="${filters.hosts}"]`)?.focus();}
  const filter=event.target.closest('[data-filter]');if(filter){filters.type=filter.dataset.filter;render();main.querySelector(`[data-filter="${filters.type}"]`)?.focus();}
  if(event.target.closest('[data-reset]')){Object.assign(filters,{type:'all',history:false,query:''});render();main.querySelector('#search')?.focus();}
});
document.addEventListener('input',event=>{
  if(event.target.id==='replay-position'){seek(event.target.value);return;}
  if(event.target.id!=='search')return;
  const start=event.target.selectionStart;filters.query=event.target.value;render();
  const input=main.querySelector('#search');input.focus();if(start!=null)try{input.setSelectionRange(start,start);}catch{}
});
document.addEventListener('change',event=>{
  if(event.target.id==='replay-position'){seek(event.target.value);return;}
  if(event.target.id==='replay-speed'){const playing=playback.playing;playback.speed=Number(event.target.value);if(playing)start();return;}
  if(event.target.id==='replay-attempt'){location.hash=`/benchmark/${event.target.dataset.config}/${event.target.value}`;return;}
  if(event.target.id==='history'){filters.history=event.target.checked;render();main.querySelector('#history').focus();}
});
document.addEventListener('keydown',event=>{
  const tab=event.target.closest('[data-detail-tab]');
  if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();const keys=['step','accounts','score','usage'],i=keys.indexOf(tab.dataset.detailTab);
    detailTab=keys[event.key==='Home'?0:event.key==='End'?3:(i+(event.key==='ArrowRight'?1:3))%4];render();main.querySelector(`[data-detail-tab="${detailTab}"]`)?.focus({preventScroll:true});
  }
});
const themeButton=document.querySelector('#theme');
function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';themeButton.setAttribute('aria-label',`Switch to ${dark?'light':'dark'} theme`);themeButton.setAttribute('aria-pressed',String(dark));}
try{setTheme(localStorage.getItem('zarena-theme')==='dark');}catch{setTheme(false);}
themeButton.addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';setTheme(dark);try{localStorage.setItem('zarena-theme',dark?'dark':'light');}catch{}});
window.addEventListener('hashchange',()=>{stop();Object.assign(playback,{position:1,host:null,source:'agent'});detailTab='step';if(data)render({focus:true});});
window.addEventListener('pagehide',stop);
try{
  const response=await fetch('./results.json',{cache:'no-store'});if(!response.ok)throw new Error('Dataset unavailable');
  data=await response.json();if(data.schema!=='zarena.public-test/v2'||!Array.isArray(data.configs)||!Array.isArray(data.attempts))throw new Error('Unsupported dataset');
  const initialStep=new URLSearchParams(location.search).get('step');
  if(initialStep!==null&&/^\d+$/.test(initialStep))playback.position=Math.min(stepCount(),Number(initialStep));
  render();
}catch{
  main.innerHTML='<section class="empty page-heading" role="alert"><h1>Results are unavailable.</h1><button class="button" id="reload">Reload results</button></section>';
  main.querySelector('#reload').addEventListener('click',()=>location.reload());
}
