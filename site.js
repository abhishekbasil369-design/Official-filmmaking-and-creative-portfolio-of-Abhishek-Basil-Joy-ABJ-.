(()=>{'use strict';
const $=id=>document.getElementById(id);
const starter=JSON.parse($('starterData').textContent);
let data=starter;
let lastFocus=null;
const labels={featured:'FEATURED WORK',creative:'CREATIVE EDIT',live:'LIVE-ACTION SHORT FILM','ai-adaptation':'AI ADAPTATION','ai-short':'AI SHORT FILM'};
const grids={featured:'featuredGrid',creative:'creativeGrid',live:'liveGrid','ai-adaptation':'adaptationGrid','ai-short':'aiShortGrid'};
function elem(tag,cls,t){const n=document.createElement(tag);if(cls)n.className=cls;if(t!==undefined)n.textContent=t;return n}
function validLink(s){try{const u=new URL(s,window.location.href);if(!['https:','http:'].includes(u.protocol))return '';return u.href}catch{return ''}}
function src(s){if(!s)return '';if(/^(assets\/)[a-zA-Z0-9_./-]+$/.test(s)&&!s.includes('..'))return s;return validLink(s)}
function mail(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||'')?s.trim():''}
function layout(){
 $('heroIntro').textContent=data.subheadline||starter.subheadline;
 $('manifestoText').textContent=data.manifesto||starter.manifesto;
 $('aboutText').textContent=data.about||starter.about;
 $('contactText').textContent=data.contact||starter.contact;
 const headline=(data.headline||starter.headline).replace(/[\n]+/g,' ').trim();
 if(headline&&headline!==starter.headline){const statement=document.querySelector('.hero-statement');statement.replaceChildren();statement.textContent=headline;}
 const ey=document.querySelector('.eyebrow');if(data.eyebrow)ey.replaceChildren(elem('span','status-dot'),document.createTextNode(data.eyebrow));
 const link=$('emailLink'),email=mail(data.email)||mail(starter.email);
 if(email){link.hidden=false;link.href=`mailto:${email}?subject=${encodeURIComponent('Let’s collaborate — ABJ')}`;link.classList.remove('inactive');link.textContent='Email me ↗';link.removeAttribute('aria-disabled');$('emailAddress').textContent=email;$('emailAddress').href=`mailto:${email}`;$('emailAddress').hidden=false}
 else{link.hidden=true;link.removeAttribute('href');$('emailAddress').hidden=true}
 const ed=$('educationList');ed.replaceChildren();(data.education||starter.education).forEach((x,i)=>{const wrapper=elem('article','education-item');wrapper.append(elem('span','edu-index',String(i+1).padStart(2,'0')+' /'));wrapper.append(elem('h3','',x.degree||''),elem('p','',x.school||''));wrapper.append(elem('small','',[(x.location||''),x.note||''].filter(Boolean).join(' · ')));ed.append(wrapper)});
 $('year').textContent=new Date().getFullYear();
 for(const [kind,id] of Object.entries(grids)){
  const root=$(id);root.replaceChildren();const projects=(data.projects||[]).filter(p=>p.kind===kind&&p.published!==false);
  if(!projects.length){root.append(elem('p','empty-grid','More projects coming soon.'));continue}
  projects.forEach((p,i)=>{const btn=elem('button','project-card');btn.type='button';btn.setAttribute('aria-label',`Explore ${p.title}`);const box=elem('div','card-photo');const cover=src(p.image||p.cover_url);if(cover){const img=elem('img');img.src=cover;img.alt=p.title+' film cover';img.loading='lazy';img.decoding='async';box.append(img)}else box.append(elem('div','card-placeholder',p.title||'ABJ'));
   box.append(elem('span','card-number',String(i+1).padStart(2,'0')));const body=elem('div','card-body');body.append(elem('span','card-label',labels[kind]||'FILM'),elem('h3','',p.title||'UNTITLED'));
   body.append(elem('p','',p.subtitle||((p.description||'').slice(0,92)+(p.description?.length>92?'…':''))||'A visual project by ABJ.'));
   body.append(elem('span','card-action',p.video||p.video_url?'WATCH FILM ↗':'EXPLORE PROJECT ↗'));btn.append(box,body);btn.addEventListener('click',()=>openProject(p));root.append(btn);
  });
 }
}
function videoContent(raw){const url=validLink(raw);if(!url)return null;const u=new URL(url);const host=u.hostname.replace(/^www\./,'').toLowerCase();let embed='';
 if(['youtube.com','m.youtube.com','music.youtube.com','youtu.be','youtube-nocookie.com'].includes(host)){
  let id='';if(host==='youtu.be')id=u.pathname.split('/').filter(Boolean)[0]||'';
  else if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
  else if(/^\/(shorts|embed|live)\//.test(u.pathname))id=u.pathname.split('/')[2]||'';
  if(/^[a-zA-Z0-9_-]{11}$/.test(id))embed='https://www.youtube-nocookie.com/embed/'+id+'?rel=0';
 }else if(host==='vimeo.com'||host==='player.vimeo.com'){
  const match=u.pathname.match(/\/(?:video\/)?(\d+)/);if(match)embed='https://player.vimeo.com/video/'+match[1];
 }
 if(embed){const iframe=elem('iframe','video-frame');iframe.src=embed;iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;iframe.title='Watch the film';return iframe}
 if(/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)||host.includes('supabase.co')){const video=elem('video','video-self');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=url;return video}
 const a=elem('a','button primary','Open video ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
}
function openProject(p){lastFocus=document.activeElement;const dialog=$('projectDialog'),cover=$('dialogCover');cover.replaceChildren();const path=src(p.image||p.cover_url);if(path){const im=elem('img');im.src=path;im.alt=p.title+' cover';cover.append(im)}else cover.append(elem('div','card-placeholder',p.title));$('dialogType').textContent=labels[p.kind]||'FILM';$('dialogTitle').textContent=p.title;$('dialogSubtitle').textContent=p.subtitle||'';$('dialogDescription').textContent=p.description||'The story behind this project is coming soon.';const area=$('playerArea');area.replaceChildren();const video=videoContent(p.video||p.video_url);$('pendingVideo').hidden=!!video;if(video)area.append(video);dialog.showModal();document.body.classList.add('modal-open')}
function closeProject(){const dlg=$('projectDialog');if(dlg.open)dlg.close();document.body.classList.remove('modal-open');$('playerArea').replaceChildren();lastFocus?.focus()}
$('closeDialog').addEventListener('click',closeProject);
$('projectDialog').addEventListener('click',event=>{if(event.target===$('projectDialog'))closeProject()});
$('projectDialog').addEventListener('close',()=>{$('playerArea').replaceChildren();document.body.classList.remove('modal-open');lastFocus?.focus()});
const menu=$('menuBtn'),nav=$('nav');menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation')});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}));
layout();
const cfg=window.ABJ_SUPABASE||{};
if(/^https:\/\//.test(cfg.url||'')&&(cfg.anonKey||'').length>15){
 const base=cfg.url.replace(/\/$/,'')+'/rest/v1/';const headers={apikey:cfg.anonKey,Authorization:'Bearer '+cfg.anonKey};
 Promise.all([fetch(base+'site_settings?select=*&id=eq.main',{headers}),fetch(base+'portfolio_projects?select=*&published=eq.true&order=sort_order.asc',{headers})]).then(async resp=>{
  if(resp.some(r=>!r.ok))return;
  const [settings,projects]=await Promise.all(resp.map(r=>r.json()));if(!settings[0]?.cloud_ready)return;
  data={...starter,...settings[0],projects:projects.map(p=>({...p,image:p.cover_url,video:p.video_url}))};layout();
 }).catch(()=>{});
}
})();
