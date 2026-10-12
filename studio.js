import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as tus from 'https://cdn.jsdelivr.net/npm/tus-js-client@4/+esm';

const $=id=>document.getElementById(id);
const cfg=window.ABJ_SUPABASE||{};
const configured=cfg.url?.startsWith('https://')&&cfg.anonKey?.length>15;
let db=null, settings=null, projects=[], activeId=null, activeUpload=null, selectedVideo=null;
let education=[];
const fields=['name','eyebrow','headline','subheadline','manifesto','about','instagram','email','contact'];
const xssSafe=t=>String(t||'');
function feedback(id,message,error=false){const elem=$(id);elem.textContent=message;elem.className='feedback '+(error?'error':'good')}
function fail(error,id='projectMessage'){feedback(id,error?.message||String(error),true)}
function show(id){for(const x of ['login','app','unconfigured'])$(x).hidden=x!==id}
function obj(type,cls,content){let el=document.createElement(type);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el}
function publicUrl(path){return db.storage.from('portfolio-media').getPublicUrl(path).data.publicUrl}
const safeMedia=u=>{try{if(/^(assets\/)[a-zA-Z0-9_./-]+$/.test(u||'')&&!(u||'').includes('..'))return u;let x=new URL(u);return ['https:','http:'].includes(x.protocol)?x.href:''}catch{return ''}};

async function start(){
 $('year').textContent=new Date().getFullYear();
 if(!configured){show('unconfigured');return}
 try{db=createClient(cfg.url,cfg.anonKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
 const {data:{user},error}=await db.auth.getUser();if(error||!user){show('login');return}await authorize();
 }catch(err){show('login');fail(err,'loginMessage')}
}
async function authorize(){
 const {data,error}=await db.rpc('is_site_admin');
 if(error)throw Error('Cloud setup is incomplete: '+error.message);
 if(data!==true){await db.auth.signOut();show('login');throw Error('This account is not your site administrator account. Add its user UUID to site_admins in Supabase SQL Editor.')}
 show('app');$('signout').hidden=false;await load();
}
async function load(){
 const [s,p]=await Promise.all([db.from('site_settings').select('*').eq('id','main').maybeSingle(), db.from('portfolio_projects').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true})]);
 if(s.error)throw s.error;if(p.error)throw p.error;
 settings=s.data;projects=p.data||[];education=structuredClone(settings?.education||[]);
 $('activate').hidden=!!settings?.cloud_ready;
 if(settings?.cloud_ready){fillBasics();renderEducation();renderProjects();}
 else $('projectEditor').hidden=true;
}
function chooseTab(which){document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===which));for(const id of ['projects','basics','education'])$(id+'Tab').hidden=id!==which}
async function activate(){
 $('activateBtn').disabled=true;$('activateMessage').textContent='Importing your covers and education…';
 try{
  const starter=await (await fetch('starter.json')).json();
  const proj=starter.projects.map((x,i)=>({id:x.id,title:x.title,subtitle:x.subtitle||'',description:x.description||'',kind:x.kind,cover_url:x.image||'',video_url:x.video||'',published:true,sort_order:i*10}));
  // Start with projects, then activate the public cloud version: if any step fails, public site stays on the original starter.
  const {error:e1}=await db.from('portfolio_projects').upsert(proj,{onConflict:'id'});if(e1)throw e1;
  const toSave={id:'main',...Object.fromEntries(fields.map(k=>[k,starter[k]])),education:starter.education,cloud_ready:true,updated_at:new Date().toISOString()};
  const {error:e2}=await db.from('site_settings').upsert(toSave,{onConflict:'id'});if(e2)throw e2;
  activeId=proj[0]?.id||null;await load();$('activateMessage').textContent='Your films are live and ready to edit.';
 }catch(err){fail(err,'activateMessage')}finally{$('activateBtn').disabled=false}
}
function renderProjects(){
 const list=$('projectList');list.replaceChildren();
 for(const p of projects){const btn=obj('button','projectRow'+(p.id===activeId?' active':''));btn.type='button';let cover=safeMedia(p.cover_url);if(cover){let im=obj('img');im.src=cover;im.alt='';btn.append(im)}else btn.append(obj('div','placeholder'));
 const desc=obj('span','',p.title);desc.append(obj('small','',p.published?'● Published':'○ Draft'));btn.append(desc);btn.addEventListener('click',()=>selectProject(p.id));list.append(btn)}
 if(!projects.length)list.append(obj('p','tiny','No films yet. Press + Add to start.'));
 if(!activeId&&projects.length)activeId=projects[0].id;
 const current=projects.find(p=>p.id===activeId);$('projectEditor').hidden=!current;
 if(current)fillProject(current);
}
function selectProject(id){activeId=id;selectedVideo=null;$('videoFile').value='';$('videoFileName').textContent='MP4 (H.264) is best for visitors on different devices. MOV may not play everywhere.';$('uploadVideo').disabled=true;
 $('videoMessage').textContent='';$('projectMessage').textContent='';renderProjects();}
function fillProject(p){$('projectForm').hidden=false;$('editorHeading').textContent='Edit: '+p.title;
 $('projectTitle').value=p.title;$('projectSubtitle').value=p.subtitle||'';$('projectKind').value=p.kind;$('projectDescription').value=p.description||'';$('projectVideoURL').value=p.video_url||'';$('projectPublished').checked=!!p.published;$('projectOrder').value=p.sort_order||0;
 let cover=safeMedia(p.cover_url);$('coverPreview').hidden=!cover;if(cover)$('coverPreview').src=cover;
 let vid=safeMedia(p.video_url);let playable=/\.(mp4|webm|mov|m4v)(?:\?|$)/i.test(vid);$('videoPreview').hidden=!playable;if(playable)$('videoPreview').src=vid;else $('videoPreview').removeAttribute('src');
}
async function saveProject(showSuccess=true){
 let p=projects.find(p=>p.id===activeId);if(!p)throw Error('Choose a film first.');
 const title=$('projectTitle').value.trim();if(!title)throw Error('Give your film a title.');
 const url=$('projectVideoURL').value.trim();if(url&&!/^https?:\/\//i.test(url))throw Error('The video URL must start with https://');
 const row={id:p.id,title,subtitle:$('projectSubtitle').value.trim(),kind:$('projectKind').value,description:$('projectDescription').value.trim(),cover_url:p.cover_url||'',video_url:url,published:$('projectPublished').checked,sort_order:Number($('projectOrder').value)||0,updated_at:new Date().toISOString()};
 const {error}=await db.from('portfolio_projects').upsert(row,{onConflict:'id'});if(error)throw error;
 Object.assign(p,row);projects.sort((a,b)=>a.sort_order-b.sort_order);renderProjects();if(showSuccess)feedback('projectMessage',row.published?'Saved. Your film is live on the website.':'Saved as a private draft.');return p;
}
async function createProject(){try{const id=crypto.randomUUID();const row={id,title:'Untitled film',subtitle:'',kind:'creative',description:'',cover_url:'',video_url:'',published:false,sort_order:projects.length*10+10};const {error}=await db.from('portfolio_projects').insert(row);if(error)throw error;projects.push(row);activeId=id;selectProject(id);$('projectTitle').focus()}catch(err){fail(err)}}
async function deleteProject(){let p=projects.find(p=>p.id===activeId);if(!p||!confirm('Delete '+p.title+' from your portfolio? This will remove the project entry. Uploaded media must be deleted separately in Supabase Storage.'))return;
 try{const {error}=await db.from('portfolio_projects').delete().eq('id',p.id);if(error)throw error;projects=projects.filter(x=>x.id!==p.id);activeId=projects[0]?.id||null;renderProjects()}catch(err){fail(err)}}

async function uploadCover(){const file=$('coverFile').files?.[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){feedback('projectMessage','Use JPG, PNG, or WebP for your cover.',true);return}
 if(file.size>12*1024*1024){feedback('projectMessage','Cover image is too large. Please choose one under 12 MB.',true);return}
 const f=$('coverFile');f.disabled=true;feedback('projectMessage','Uploading cover…');
 try{const p=await saveProject(false);const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`covers/${p.id}/${crypto.randomUUID()}.${extension}`;
 const {error}=await db.storage.from('portfolio-media').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
 p.cover_url=publicUrl(path);const {error:upd}=await db.from('portfolio_projects').update({cover_url:p.cover_url}).eq('id',p.id);if(upd)throw upd;fillProject(p);renderProjects();feedback('projectMessage','New cover uploaded successfully.');
 }catch(err){fail(err)}finally{f.disabled=false;f.value=''}
}
async function uploadVideo(){const f=selectedVideo;if(!f)return;
 const p=projects.find(p=>p.id===activeId);if(!p)return;
 // First save title, description, published state and the previous video URL. Only replace video URL after successful upload.
 try{await saveProject(false)}catch(err){fail(err,'videoMessage');return}
 const videoExt=f.name.split('.').pop().toLowerCase();const ext=['mp4','webm','mov','m4v'].includes(videoExt)?videoExt:'mp4';
 const mime=f.type||({mov:'video/quicktime',mp4:'video/mp4',m4v:'video/x-m4v',webm:'video/webm'}[ext]);
 const storagePath=`videos/${p.id}/${crypto.randomUUID()}.${ext}`;
 const hostname=new URL(cfg.url).hostname;const projectRef=hostname.split('.')[0];
 const endpoint=hostname.endsWith('.supabase.co')?`https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`:`${cfg.url.replace(/\/$/,'')}/storage/v1/upload/resumable`;
 const {data:{session},error:sessionErr}=await db.auth.getSession();if(sessionErr||!session?.access_token){feedback('videoMessage','Your session expired. Sign in again.',true);return}
 $('uploadVideo').disabled=true;$('videoFile').disabled=true;$('cancelUpload').hidden=false;$('uploadProgress').hidden=false;$('progressFill').style.width='0%';$('progressText').textContent='0%';
 feedback('videoMessage','Uploading your film… Keep this tab open.');
 try{
  await new Promise((resolve,reject)=>{const upload=new tus.Upload(f,{
   endpoint,retryDelays:[0,3000,5000,10000,20000],headers:{authorization:`Bearer ${session.access_token}`},
   uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
   metadata:{bucketName:'portfolio-media',objectName:storagePath,contentType:mime,cacheControl:'3600'},
   chunkSize:6*1024*1024,
   onError:reject,onProgress:(done,total)=>{let pct=total?Math.round(done*100/total):0;$('progressFill').style.width=pct+'%';$('progressText').textContent=pct+'%'},onSuccess:resolve
  });activeUpload=upload;upload.findPreviousUploads().then(prev=>{if(prev.length)upload.resumeFromPreviousUpload(prev[0]);upload.start()}).catch(reject)});
  const videoUrl=publicUrl(storagePath);
  const {error}=await db.from('portfolio_projects').update({video_url:videoUrl,updated_at:new Date().toISOString()}).eq('id',p.id);if(error)throw error;
  p.video_url=videoUrl;selectedVideo=null;$('videoFile').value='';$('projectVideoURL').value=videoUrl;fillProject(p);renderProjects();feedback('videoMessage',p.published?'Upload finished. Your audience can watch it now!':'Upload finished. Publish this film when you are ready.');
 }catch(err){fail(err,'videoMessage')}finally{$('uploadVideo').disabled=!selectedVideo;$('videoFile').disabled=false;$('cancelUpload').hidden=true;activeUpload=null}
}
const keyToInput={name:'siteName',eyebrow:'siteEyebrow',headline:'siteHeadline',subheadline:'siteSubheadline',manifesto:'siteManifesto',about:'siteAbout',instagram:'siteInstagram',email:'siteEmail',contact:'siteContact'};
function fillBasics(){for(const key of fields)$(keyToInput[key]).value=settings?.[key]||''}
async function saveBasics(e){e.preventDefault();try{const update={id:'main',...Object.fromEntries(fields.map(k=>[k,$(keyToInput[k]).value.trim()])),cloud_ready:true,updated_at:new Date().toISOString()};const {error}=await db.from('site_settings').upsert(update,{onConflict:'id'});if(error)throw error;settings={...settings,...update};feedback('basicsMessage','Saved. Your public homepage has been updated.')}catch(err){fail(err,'basicsMessage')}}
function entryElem(value={},idx){const div=obj('div','eduEntry');const h=obj('h3','',`Qualification ${idx+1}`);div.append(h);
 for(const [key,label,area] of [['degree','Degree or diploma',false],['school','College or institute',false],['location','Location',false],['note','Optional note',true]]){const wrap=obj('label','',label), inp=obj(area?'textarea':'input');inp.value=value[key]||'';inp.dataset.key=key;if(area)inp.rows=2;wrap.append(inp);div.append(wrap)}
 const del=obj('button','danger','Remove qualification');del.type='button';del.addEventListener('click',()=>{div.remove();document.querySelectorAll('#educationEntries .eduEntry h3').forEach((h,i)=>h.textContent=`Qualification ${i+1}`)});div.append(del);return div}
function renderEducation(){const root=$('educationEntries');root.replaceChildren();education.forEach((e,i)=>root.append(entryElem(e,i)))}
function addEducation(){const root=$('educationEntries');root.append(entryElem({},root.children.length))}
async function saveEducation(){const values=[...document.querySelectorAll('#educationEntries .eduEntry')].map(entry=>{let row={};entry.querySelectorAll('[data-key]').forEach(input=>row[input.dataset.key]=input.value.trim());return row}).filter(x=>x.degree||x.school);try{
 const {error}=await db.from('site_settings').update({education:values,updated_at:new Date().toISOString()}).eq('id','main');if(error)throw error;education=values;feedback('educationMessage','Education saved on the public website.')
 }catch(err){fail(err,'educationMessage')}}

$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginButton').disabled=true;feedback('loginMessage','Signing in…');try{const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;await authorize();feedback('loginMessage','')}catch(err){fail(err,'loginMessage')}finally{$('loginButton').disabled=false}});
$('signout').addEventListener('click',async()=>{if(activeUpload)activeUpload.abort();await db.auth.signOut();$('signout').hidden=true;show('login')});
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>chooseTab(btn.dataset.tab)));
$('activateBtn').addEventListener('click',activate);
$('newProject').addEventListener('click',createProject);
$('projectForm').addEventListener('submit',async e=>{e.preventDefault();try{await saveProject()}catch(err){fail(err)}});
$('deleteProject').addEventListener('click',deleteProject);
$('coverFile').addEventListener('change',uploadCover);
$('videoFile').addEventListener('change',e=>{selectedVideo=e.target.files?.[0]||null;$('uploadVideo').disabled=!selectedVideo;$('videoFileName').textContent=selectedVideo?`${selectedVideo.name} · ${(selectedVideo.size/1024/1024).toFixed(1)} MB`:'No video selected';if(selectedVideo&&/\.(mov)$/i.test(selectedVideo.name))feedback('videoMessage','MOV videos may not play in every browser. MP4 with H.264 is recommended.',true)});
$('uploadVideo').addEventListener('click',uploadVideo);
$('cancelUpload').addEventListener('click',async()=>{if(activeUpload){await activeUpload.abort();activeUpload=null;feedback('videoMessage','Upload cancelled. You can select the file and retry.',true)}});
$('basicsForm').addEventListener('submit',saveBasics);
$('addEducation').addEventListener('click',addEducation);
$('saveEducation').addEventListener('click',saveEducation);
start();
