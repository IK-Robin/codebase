/* MiniCMS Pro+ — Admin Fixed
   - Google auth + role gate (roles/{uid} -> {role:"admin"})
   - Full CRUD (add/edit/delete)
   - Block add buttons work
   - Prism highlighting in preview
   - Live Preview (HTML/CSS/JS)
*/

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
function escapeHtml(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function setStatus(msg){ $('#status-text').textContent = msg; setTimeout(()=>$('#status-text').textContent='',2000); }
function debounce(fn, ms=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

const appEl = $('#app');
const notAdminEl = $('#not-admin');
const btnLogin = $('#admin-login');
const btnLogout = $('#admin-logout');
const emailEl = $('#admin-email');

btnLogin.onclick = async () => {
  try { provider.setCustomParameters({prompt:'select_account'}); await auth.signInWithPopup(provider); }
  catch(e){ console.error(e); alert(`Google sign-in failed: ${e.message}`); }
};
btnLogout.onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    emailEl.textContent=''; appEl.classList.add('hidden'); notAdminEl.classList.add('hidden');
    btnLogout.classList.add('hidden'); btnLogin.classList.remove('hidden');
    return;
  }
  emailEl.textContent = user.email || user.uid;
  btnLogout.classList.remove('hidden'); btnLogin.classList.add('hidden');

  const roleDoc = await db.collection('roles').doc(user.uid).get();
  const isAdmin = roleDoc.exists && roleDoc.data().role === 'admin';
  if(isAdmin){ appEl.classList.remove('hidden'); notAdminEl.classList.add('hidden'); bootstrap(); }
  else { appEl.classList.add('hidden'); notAdminEl.classList.remove('hidden'); }
});

// ---------------- state
let currentId = null;
let listReqId = 0;

// ---------------- CRUD
async function save(){
  const data = {
    title: $('#title').value.trim() || 'Untitled',
    slug: $('#slug').value.trim(),
    tags: $('#tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean),
    description: $('#description').value,
    blocks: readBlocksFromUI(),
    status: $('#status').value || 'draft',
    updated: new Date().toISOString(),
    authorUid: auth.currentUser?.uid || null
  };
  if(!currentId){
    data.created = data.updated;
    const ref = await db.collection('posts').add(data);
    currentId = ref.id;
  } else {
    await db.collection('posts').doc(currentId).set(data,{merge:true});
  }
  setStatus('Saved');
  loadList();
}

async function del(){
  if(!currentId) return;
  if(!confirm('Delete this post?')) return;
  await db.collection('posts').doc(currentId).delete();
  currentId=null; clearEditor(); setStatus('Deleted'); loadList();
}

function setEditor(id, data){
  currentId = id;
  $('#title').value = data?.title || '';
  $('#slug').value  = data?.slug || '';
  $('#tags').value  = (data?.tags||[]).join(', ');
  $('#status').value = data?.status || 'draft';
  $('#description').value = data?.description || '';
  renderBlocks(data?.blocks || []);
  renderPreview(); maybeRunLive();
}

function clearEditor(){
  $('#title').value=''; $('#slug').value=''; $('#tags').value='';
  $('#status').value='draft'; $('#description').value='';
  $('#blocks').innerHTML='';
  renderPreview(); maybeRunLive();
}

// ---------------- blocks
function readBlocksFromUI(){
  return $$('#blocks > .block').map(b=>{
    const type=b.dataset.type;
    if(type==='text') return {type, text:$('.text-input',b).value};
    if(type==='code') return {type, lang:$('.lang',b).value.trim(), caption:$('.caption',b).value, code:$('.code-input',b).value};
    if(type==='quote')return {type, text:$('.quote-input',b).value, cite:$('.cite',b).value};
    if(type==='list') return {type, style:$('.list-style',b).value, items:$('.list-input',b).value};
    if(type==='divider')return {type};
    return {type};
  });
}

function renderBlocks(blocks){
  const ul=$('#blocks'); ul.innerHTML='';
  blocks.forEach(b=>{
    const tpl=document.getElementById(`tpl-block-${b.type}`); if(!tpl) return;
    const el=tpl.content.cloneNode(true);
    if(b.type==='text'){ el.querySelector('.text-input').value=b.text||''; }
    if(b.type==='code'){ el.querySelector('.lang').value=b.lang||''; el.querySelector('.caption').value=b.caption||''; el.querySelector('.code-input').value=b.code||''; }
    if(b.type==='quote'){ el.querySelector('.quote-input').value=b.text||''; el.querySelector('.cite').value=b.cite||''; }
    if(b.type==='list'){ el.querySelector('.list-style').value=b.style||'ul'; el.querySelector('.list-input').value=b.items||''; }
    wireBlock(el);
    ul.append(el);
  });
}

function wireBlock(root){
  const el=root.querySelector('.block')||root;
  $('.move-up',el)?.addEventListener('click',()=>moveBlock(el,-1));
  $('.move-down',el)?.addEventListener('click',()=>moveBlock(el,+1));
  $('.del',el)?.addEventListener('click',()=>el.remove());
  $$('textarea,input,select',el).forEach(i=> i.addEventListener('input',()=>{ renderPreview(); maybeRunLive(); }));
}

function moveBlock(el,dir){
  const p=el.parentElement; const i=[...p.children].indexOf(el);
  const n=i+dir; if(n<0||n>=p.children.length) return;
  p.removeChild(el); p.insertBefore(el,p.children[n]);
  renderPreview(); maybeRunLive();
}

// ---------------- preview
function renderPreview(){
  const data={title:$('#title').value||'Untitled', description:$('#description').value, blocks:readBlocksFromUI()};
  const root=$('#preview-article'); root.innerHTML='';
  const h1=document.createElement('h1'); h1.textContent=data.title; root.append(h1);
  if(data.description){ const p=document.createElement('p'); p.className='desc'; p.textContent=data.description; root.append(p); }

  data.blocks.forEach(b=>{
    if(b.type==='text'){ const p=document.createElement('p'); p.innerHTML=escapeHtml(b.text||'').replace(/\n/g,'<br/>'); root.append(p); }



else if (b.type === 'code') {
  const wrap = document.createElement('details');
  wrap.open = true; // start expanded

  const sum = document.createElement('summary');
  sum.textContent = b.caption || (b.lang ? `${b.lang.toUpperCase()} code` : 'Code block');
  sum.style.cursor = 'pointer';

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.className = b.lang ? `language-${b.lang.toLowerCase()}` : '';
  code.textContent = b.code || '';

  pre.append(code);
  wrap.append(sum, pre);
  root.append(wrap);
}

    else if(b.type==='quote'){ const q=document.createElement('blockquote'); q.innerHTML=escapeHtml(b.text||'').replace(/\n/g,'<br/>'); if(b.cite){ const c=document.createElement('div'); c.className='muted'; c.textContent='— '+b.cite; q.append(c);} root.append(q);}
    else if(b.type==='list'){ const items=(b.items||'').split(/\r?\n/).filter(Boolean); const list=(b.style||'ul')==='ol'?document.createElement('ol'):document.createElement('ul'); items.forEach(it=>{ const li=document.createElement('li'); li.textContent=it; list.append(li);}); root.append(list);}
    else if(b.type==='divider'){ root.append(document.createElement('hr')); }
  });
  if(window.Prism) Prism.highlightAllUnder(root);
}

// ---------------- live preview
function buildSandboxHTML(blocks){
  let html='',css='',js='';
  blocks.forEach(b=>{
    if(b.type!=='code'||!b.lang) return;
    const L=b.lang.toLowerCase();
    if(L==='html') html+=b.code+'\n';
    if(L==='css')  css+=b.code+'\n';
    if(L==='js'||L==='javascript') js+=b.code+'\n';
  });
  if(!(html||css||js)) return null;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}<script>try{${js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style="color:red">'+e+'</pre>');}<\/script></body></html>`;
}
function runLive(){
  const src=buildSandboxHTML(readBlocksFromUI());
  const wrap=$('#live-wrap'); wrap.classList.remove('hidden');
  $('#live-iframe').srcdoc=src||'<!doctype html><html><body><pre>No HTML/CSS/JS blocks.</pre></body></html>';
}
const maybeRunLive=debounce(runLive,300);
$('#tab-rendered').addEventListener('click',()=>{ $('#tab-rendered').classList.add('primary'); $('#tab-live').classList.remove('primary'); $('#preview-article').classList.remove('hidden'); $('#live-wrap').classList.add('hidden'); });
$('#tab-live').addEventListener('click',()=>{ $('#tab-live').classList.add('primary'); $('#tab-rendered').classList.remove('primary'); $('#preview-article').classList.add('hidden'); runLive(); });

// ---------------- list
async function loadList(){
  const myReq=++listReqId; const q=$('#post-search').value.trim().toLowerCase(); const ul=$('#post-list');
  ul.innerHTML='<li class="muted" style="padding:10px">Loading…</li>';
  try{
    const snap=await db.collection('posts').get();
    if(myReq!==listReqId) return;
    const docs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=> String(b.updated||'').localeCompare(String(a.updated||'')));
    ul.innerHTML='';
    docs.forEach(d=>{
      if(q && !((d.title||'').toLowerCase().includes(q)||(d.tags||[]).join(',').toLowerCase().includes(q))) return;
      const li=document.createElement('li'); li.dataset.id=d.id;
      const left=document.createElement('div');
      const t=document.createElement('div'); t.className='title'; t.textContent=d.title||'Untitled';
      const s=document.createElement('div'); s.className='time'; s.textContent=(d.status||'draft')+' • '+(d.updated||'');
      left.append(t,s); li.append(left,document.createElement('div'));
      li.onclick=()=>setEditor(d.id,d); ul.append(li);
    });
    if(!ul.children.length) ul.innerHTML='<li class="muted" style="padding:10px">No posts.</li>';
  }catch(e){ console.error('loadList failed:',e); ul.innerHTML='<li class="muted" style="padding:10px">Error loading.</li>'; }
}

// ---------------- bootstrap
function bootstrap(){
  $('#btn-new').onclick=()=>{ currentId=null; clearEditor(); };
  $('#btn-delete').onclick=del;
  $('#btn-save').onclick=save;
  $('#post-search').addEventListener('input',debounce(loadList,250));

  // block adders
  $('#add-text').onclick = ()=>{ const tpl=$('#tpl-block-text'); const el=tpl.content.cloneNode(true); wireBlock(el); $('#blocks').append(el); renderPreview(); };
  $('#add-code').onclick = ()=>{ const tpl=$('#tpl-block-code'); const el=tpl.content.cloneNode(true); wireBlock(el); $('#blocks').append(el); renderPreview(); };
  $('#add-quote').onclick= ()=>{ const tpl=$('#tpl-block-quote');const el=tpl.content.cloneNode(true);wireBlock(el);$('#blocks').append(el);renderPreview(); };
  $('#add-list').onclick = ()=>{ const tpl=$('#tpl-block-list');const el=tpl.content.cloneNode(true);wireBlock(el);$('#blocks').append(el);renderPreview(); };
  $('#add-divider').onclick=()=>{ const tpl=$('#tpl-block-divider');const el=tpl.content.cloneNode(true);wireBlock(el);$('#blocks').append(el);renderPreview(); };

  clearEditor(); loadList();
}
