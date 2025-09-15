// Frontend: auth required; published posts only; client-side sort & tag filter (no composite index needed)
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

const grid = document.getElementById('posts-grid');
const view = document.getElementById('post-view');
const tagRow = document.getElementById('tag-row');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userEmail = document.getElementById('user-email');

let allPosts = [];
let activeTag = null;

const provider = new firebase.auth.GoogleAuthProvider();
btnLogin.onclick  = () => auth.signInWithPopup(provider);
btnLogout.onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    userEmail.textContent = '';
    btnLogout.classList.add('hidden');
    btnLogin.classList.remove('hidden');
    grid.innerHTML = '<div class="muted">Please sign in to view posts.</div>';
    view.classList.add('hidden');
    return;
  }
  userEmail.textContent = user.email || user.uid;
  btnLogout.classList.remove('hidden');
  btnLogin.classList.add('hidden');
  try {
    await loadPublished(); // only when signed in
  } catch(e){
    console.error(e);
    grid.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
});

async function loadPublished(){
  grid.innerHTML = '<div class="muted">Loading...</div>';
  // No orderBy here (avoids composite index); we'll sort in JS
  const snap = await db.collection('posts')
    .where('status','==','published')
    .get();
  allPosts = snap.docs.map(d=>({id:d.id, ...d.data()}));
  allPosts.sort((a,b)=> String(b.updated||'').localeCompare(String(a.updated||'')) );

  renderTags();
  renderList();

  // Handle slug permalink (?slug=...) or #/post/slug
  const slugQ = new URL(location.href).searchParams.get('slug');
  const hash = location.hash;
  if(slugQ){
    const found = allPosts.find(p=> (p.slug||'') === slugQ);
    if(found) openPost(found.id, found);
  } else if(hash.startsWith('#/post/')){
    const slug = decodeURIComponent(hash.split('#/post/')[1]);
    const found = allPosts.find(p=> (p.slug||'') === slug);
    if(found) openPost(found.id, found);
  }
}

function renderTags(){
  const set = new Set();
  allPosts.forEach(p => (p.tags||[]).forEach(t => set.add(t)));
  tagRow.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'tag' + (activeTag? '' : ' active');
  allBtn.textContent = 'All';
  allBtn.onclick = ()=>{ activeTag=null; renderTags(); renderList(); };
  tagRow.append(allBtn);

  Array.from(set).sort().forEach(t=>{
    const b = document.createElement('button');
    b.className = 'tag' + (activeTag===t ? ' active' : '');
    b.textContent = t;
    b.onclick = ()=>{ activeTag = (activeTag===t ? null : t); renderTags(); renderList(); };
    tagRow.append(b);
  });
}

function renderList(){
  grid.classList.remove('hidden');
  view.classList.add('hidden');
  grid.innerHTML='';
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
  grid.classList.add('hidden');
  view.classList.remove('hidden');
  renderArticle(view, d);
  history.replaceState(null, '', `?slug=${encodeURIComponent(d.slug||'')}`);
}

function escapeHtml(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function renderArticle(root, data){
  root.innerHTML='';
  const h1 = document.createElement('h2'); h1.textContent = data.title || 'Untitled'; root.append(h1);
  if(data.description){ const p = document.createElement('p'); p.className='muted'; p.textContent=data.description; root.append(p); }
  (data.blocks||[]).forEach(b=>{
    if(b.type==='text'){
      const p = document.createElement('p');
      p.innerHTML = escapeHtml(b.text||'').replace(/\n/g,'<br/>');
      root.append(p);
    } else if(b.type==='code'){
      const codebar = document.createElement('div');
      codebar.className='codebar';
      const lang = document.createElement('span'); lang.className='lang'; lang.textContent = b.lang || 'code';
      const copy = document.createElement('button'); copy.className='btn tiny ghost copy-inline'; copy.textContent='Copy code';
      copy.onclick = ()=> navigator.clipboard.writeText(b.code || '');
      codebar.append(lang, copy);
      root.append(codebar);

      if(b.caption){ const cap = document.createElement('div'); cap.className='muted'; cap.textContent=b.caption; root.append(cap); }
      const pre = document.createElement('pre'); const code = document.createElement('code');
      const prismClass = b.lang ? `language-${b.lang.toLowerCase()}` : '';
      code.className = prismClass;
      code.textContent = b.code || '';
      pre.append(code); root.append(pre);
    } else if(b.type==='divider'){
      root.append(document.createElement('hr'));
    } else if(b.type==='quote'){
      const q = document.createElement('blockquote');
      q.innerHTML = escapeHtml(b.text||'').replace(/\n/g,'<br/>');
      if(b.cite){ const cite = document.createElement('div'); cite.className='muted'; cite.textContent = '— ' + b.cite; q.append(document.createElement('br')); q.append(cite); }
      root.append(q);
    } else if(b.type==='list'){
      const items = (b.items || '').split(/\r?\n/).filter(Boolean);
      const list = (b.style||'ul') === 'ol' ? document.createElement('ol') : document.createElement('ul');
      items.forEach(it=>{ const li = document.createElement('li'); li.textContent = it; list.append(li); });
      root.append(list);
    }
  });
  if(window.Prism){ Prism.highlightAllUnder(root); }

  const back = document.createElement('button'); back.className='btn ghost'; back.textContent='← Back';
  back.onclick = ()=>{ view.classList.add('hidden'); grid.classList.remove('hidden'); history.replaceState(null,'', activeTag? `?tag=${encodeURIComponent(activeTag)}` : ''); };
  root.append(back);
}
