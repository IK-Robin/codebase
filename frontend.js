// MiniCMS Pro+ Frontend
// - Google auth required to read
// - Tag filters, Prism highlighting
// - Slug permalinks, copy link
// - Live Preview (HTML/CSS/JS)

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

const grid      = document.getElementById('posts-grid');
const view      = document.getElementById('post-view');
const tagRow    = document.getElementById('tag-row');
const btnLogin  = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userEmail = document.getElementById('user-email');

const postActions = document.getElementById('post-actions');
const btnBack     = document.getElementById('btn-back');
const btnLive     = document.getElementById('btn-live');
const btnCopyLink = document.getElementById('btn-copylink');
const liveWrap    = document.getElementById('front-live');
const liveFrame   = document.getElementById('front-iframe');

let allPosts = [];
let activeTag = null;
let openedPost = null;

const provider = new firebase.auth.GoogleAuthProvider();
btnLogin.onclick  = async () => {
  try { provider.setCustomParameters({prompt:'select_account'}); await auth.signInWithPopup(provider); }
  catch(e){ alert(`Google sign-in failed: ${e.code}\n${e.message}`); }
};
btnLogout.onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    userEmail.textContent = '';
    btnLogout.classList.add('hidden');
    btnLogin.classList.remove('hidden');
    grid.innerHTML = '<div class="muted">Please sign in to view posts.</div>';
    view.classList.add('hidden'); postActions.classList.add('hidden'); liveWrap.classList.add('hidden');
    return;
  }
  userEmail.textContent = user.email || user.uid;
  btnLogout.classList.remove('hidden');
  btnLogin.classList.add('hidden');
  try {
    await loadPublished();
  } catch(e){
    console.error(e);
    grid.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
});

// ---------------- helpers
function escapeHtml(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

// Build runnable HTML from HTML/CSS/JS code blocks
function buildSandboxHTML(blocks){
  let html='', css='', js='';
  (blocks||[]).forEach(b=>{
    if(b.type!=='code' || !b.lang) return;
    const L = b.lang.toLowerCase();
    if(L==='html') html += (b.code||'') + '\n';
    if(L==='css')  css  += (b.code||'') + '\n';
    if(L==='js' || L==='javascript') js += (b.code||'') + '\n';
  });
  if(!(html||css||js)) return null;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
${html}
<script>
try{${js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style="color:red">'+e+'</pre>');}
<\/script></body></html>`;
}

function showLive(blocks){
  const src = buildSandboxHTML(blocks);
  if(!src){
    liveFrame.srcdoc = '<!doctype html><html><body><pre>No HTML/CSS/JS code blocks to run.</pre></body></html>';
  } else {
    liveFrame.srcdoc = src;
  }
  liveWrap.classList.remove('hidden');
  view.classList.add('hidden');
}

function hideLive(){
  liveWrap.classList.add('hidden');
  view.classList.remove('hidden');
}

// ---------------- data load + UI
async function loadPublished(){
  grid.innerHTML = '<div class="muted">Loading…</div>';
  // Sort in JS (no composite index required)
  const snap = await db.collection('posts').where('status','==','published').get();
  allPosts = snap.docs.map(d=>({id:d.id, ...d.data()}));
  allPosts.sort((a,b)=> String(b.updated||'').localeCompare(String(a.updated||'')) );

  renderTags();
  renderList();

  // Handle permalinks (?slug=) or #/post/<slug>
  const u = new URL(location.href);
  const slugQ = u.searchParams.get('slug');
  const hash = location.hash;
  if(slugQ){
    const found = allPosts.find(p => (p.slug||'') === slugQ);
    if(found) openPost(found.id, found);
  } else if(hash.startsWith('#/post/')){
    const slug = decodeURIComponent(hash.split('#/post/')[1]);
    const found = allPosts.find(p => (p.slug||'') === slug);
    if(found) openPost(found.id, found);
  }
}

function renderTags(){
  const set = new Set();
  allPosts.forEach(p => (p.tags||[]).forEach(t => set.add(t)));
  tagRow.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'tag' + (activeTag ? '' : ' active');
  allBtn.textContent = 'All';
  allBtn.onclick = ()=>{ activeTag=null; renderTags(); renderList(); };
  tagRow.append(allBtn);

  Array.from(set).sort().forEach(tag=>{
    const b = document.createElement('button');
    b.className = 'tag' + (activeTag===tag ? ' active' : '');
    b.textContent = tag;
    b.onclick = ()=>{ activeTag = (activeTag===tag ? null : tag); renderTags(); renderList(); };
    tagRow.append(b);
  });
}

function renderList(){
  grid.classList.remove('hidden');
  view.classList.add('hidden');
  postActions.classList.add('hidden');
  liveWrap.classList.add('hidden');

  grid.innerHTML = '';
  const list = allPosts.filter(p => !activeTag || (p.tags||[]).includes(activeTag));
  if(!list.length){
    grid.innerHTML = '<div class="muted">No posts match this filter.</div>';
    return;
  }
  list.forEach(d=>{
    const card = document.getElementById('card-template').content.cloneNode(true);
    card.querySelector('.title').textContent = d.title || 'Untitled';
    card.querySelector('.muted').textContent = (d.tags||[]).join(', ');
    card.querySelector('.open').onclick = ()=> openPost(d.id, d);
    card.querySelector('.copy-link').onclick = ()=> {
      const url = `${location.origin}${location.pathname}?slug=${encodeURIComponent(d.slug||'')}`;
      navigator.clipboard.writeText(url);
    };
    grid.append(card);
  });
}

function openPost(id, d){
  openedPost = d;
  grid.classList.add('hidden');
  view.classList.remove('hidden');
  postActions.classList.remove('hidden');
  liveWrap.classList.add('hidden');

  // back / live / copy
  btnBack.onclick = ()=>{
    postActions.classList.add('hidden');
    liveWrap.classList.add('hidden');
    view.classList.add('hidden');
    grid.classList.remove('hidden');
    history.replaceState(null,'', location.pathname); // clear slug param
  };
  btnLive.onclick = ()=> showLive(d.blocks||[]);
  btnCopyLink.onclick = ()=>{
    const url = `${location.origin}${location.pathname}?slug=${encodeURIComponent(d.slug||'')}`;
    navigator.clipboard.writeText(url);
  };

  renderArticle(view, d);
  // update URL (permamlink)
  history.replaceState(null, '', `?slug=${encodeURIComponent(d.slug||'')}`);
}

function renderArticle(root, data){
  root.innerHTML='';
  const h1 = document.createElement('h2'); h1.textContent = data.title || 'Untitled'; root.append(h1);
  if(data.description){ const p=document.createElement('p'); p.className='muted'; p.textContent = data.description; root.append(p); }

  (data.blocks||[]).forEach(b=>{
    if(b.type==='text'){
      const p = document.createElement('p');
      p.innerHTML = escapeHtml(b.text||'').replace(/\n/g,'<br/>');
      root.append(p);
    } 
    
    
  else if (b.type === 'code') {
  const wrap = document.createElement('details');
  wrap.open = true;

  const sum = document.createElement('summary');
  sum.textContent = b.caption || (b.lang ? `${b.lang.toUpperCase()} code` : 'Code block');
  sum.style.cursor = 'pointer';

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.className = b.lang ? `language-${b.lang.toLowerCase()}` : '';
  code.textContent = b.code || '';

  const copy = document.createElement('button');
  copy.textContent = 'Copy';
  copy.className = 'btn tiny ghost';
  copy.style.marginLeft = '8px';
  copy.onclick = () => {
    navigator.clipboard.writeText(b.code || '');
    copy.textContent = 'Copied!';
    setTimeout(() => (copy.textContent = 'Copy'), 1500);
  };

  wrap.append(sum, copy, pre);
  pre.append(code);
  root.append(wrap);
}
else if(b.type==='divider'){
      root.append(document.createElement('hr'));
    } else if(b.type==='quote'){
      const q = document.createElement('blockquote');
      q.innerHTML = escapeHtml(b.text||'').replace(/\n/g,'<br/>');
      if(b.cite){ const cite=document.createElement('div'); cite.className='muted'; cite.textContent='— '+b.cite; q.append(document.createElement('br')); q.append(cite); }
      root.append(q);
    } else if(b.type==='list'){
      const items=(b.items||'').split(/\r?\n/).filter(Boolean);
      const list=(b.style||'ul')==='ol'?document.createElement('ol'):document.createElement('ul');
      items.forEach(it=>{ const li=document.createElement('li'); li.textContent=it; list.append(li); });
      root.append(list);
    }
  });

  if(window.Prism){ Prism.highlightAllUnder(root); }  // syntax highlight
  // show article, hide live if it was open
  hideLive();
}
