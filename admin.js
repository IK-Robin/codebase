// MiniCMS Pro+ Admin — full CRUD with Google auth + role gate.
// Requires Firestore collections: posts, roles (roles/{uid} = {role:"admin"})
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

const provider = new firebase.auth.GoogleAuthProvider();

// --- DOM ---
const appEl      = document.getElementById('app');
const notAdminEl = document.getElementById('not-admin');
const emailEl    = document.getElementById('admin-email');
const btnLogin   = document.getElementById('admin-login');
const btnLogout  = document.getElementById('admin-logout');

btnLogin.onclick  = async () => {
  try {
    provider.setCustomParameters({ prompt: 'select_account' });
    await auth.signInWithPopup(provider);
  } catch (e) {
    console.error('Google sign-in failed:', e);
    alert(`Google sign-in failed: ${e.code}\n${e.message}`);
  }
};
btnLogout.onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    emailEl.textContent = '';
    appEl.classList.add('hidden');
    notAdminEl.classList.add('hidden');
    btnLogout.classList.add('hidden');
    btnLogin.classList.remove('hidden');
    return;
  }
  emailEl.textContent = user.email || user.uid;
  btnLogout.classList.remove('hidden');
  btnLogin.classList.add('hidden');

  try {
    const roleDoc = await db.collection('roles').doc(user.uid).get();
    const isAdmin = roleDoc.exists && roleDoc.data().role === 'admin';
    if (isAdmin) {
      appEl.classList.remove('hidden');
      notAdminEl.classList.add('hidden');
      bootstrap();
    } else {
      appEl.classList.add('hidden');
      notAdminEl.classList.remove('hidden');
    }
  } catch (e) {
    console.error('role check failed:', e);
    notAdminEl.classList.remove('hidden');
  }
});

// --- editor state ---
let currentId = null;
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function setStatus(msg){
  $('#status-text').textContent = msg;
  setTimeout(() => $('#status-text').textContent = '', 1800);
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}

// Build a block array from UI
function readBlocksFromUI(){
  return $$('#blocks > .block').map(b => {
    const type = b.dataset.type;
    if (type === 'text')   return { type, text: $('.text-input', b).value };
    if (type === 'code')   return { type, lang: $('.lang', b).value.trim(), caption: $('.caption', b).value, code: $('.code-input', b).value };
    if (type === 'quote')  return { type, text: $('.quote-input', b).value, cite: $('.cite', b).value };
    if (type === 'list')   return { type, style: $('.list-style', b).value, items: $('.list-input', b).value };
    if (type === 'divider')return { type };
    return { type };
  });
}

// Render blocks into the editor list from data
function renderBlocks(blocks){
  const ul = $('#blocks'); ul.innerHTML = '';
  (blocks || []).forEach(b => {
    if (b.type === 'text'){
      const el = $('#tpl-block-text').content.cloneNode(true);
      el.querySelector('.text-input').value = b.text || '';
      wireBlock(el); ul.append(el);
    } else if (b.type === 'code'){
      const el = $('#tpl-block-code').content.cloneNode(true);
      el.querySelector('.lang').value    = b.lang || '';
      el.querySelector('.caption').value = b.caption || '';
      el.querySelector('.code-input').value = b.code || '';
      wireBlock(el); ul.append(el);
    } else if (b.type === 'quote'){
      const el = $('#tpl-block-quote').content.cloneNode(true);
      el.querySelector('.quote-input').value = b.text || '';
      el.querySelector('.cite').value        = b.cite || '';
      wireBlock(el); ul.append(el);
    } else if (b.type === 'list'){
      const el = $('#tpl-block-list').content.cloneNode(true);
      el.querySelector('.list-style').value = b.style || 'ul';
      el.querySelector('.list-input').value = b.items || '';
      wireBlock(el); ul.append(el);
    } else if (b.type === 'divider'){
      const el = $('#tpl-block-divider').content.cloneNode(true);
      wireBlock(el); ul.append(el);
    }
  });
}

// Wire controls inside a block
function wireBlock(root){
  const el   = root.querySelector('.block') || root;
  const up   = $('.move-up', el);
  const down = $('.move-down', el);
  const del  = $('.del', el);
  up   && (up.onclick   = () => moveBlock(el, -1));
  down && (down.onclick = () => moveBlock(el, +1));
  del  && (del.onclick  = () => el.remove());
  $$('textarea, input, select', el).forEach(i => i.addEventListener('input', renderPreview));
}

function moveBlock(el, dir){
  const parent = el.parentElement;
  const idx = Array.from(parent.children).indexOf(el);
  const n   = idx + dir;
  if (n < 0 || n >= parent.children.length) return;
  parent.removeChild(el);
  parent.insertBefore(el, parent.children[n]);
  renderPreview();
}

// Live preview
function renderPreview(){
  const data = {
    title: $('#title').value || 'Untitled',
    description: $('#description').value || '',
    blocks: readBlocksFromUI()
  };
  const root = $('#preview-article'); root.innerHTML = '';
  const h1 = document.createElement('h1'); h1.textContent = data.title; root.append(h1);
  if (data.description){
    const p = document.createElement('p'); p.className = 'desc'; p.textContent = data.description; root.append(p);
  }
  data.blocks.forEach(b => {
    if (b.type === 'text'){
      const p = document.createElement('p'); p.innerHTML = escapeHtml(b.text||'').replace(/\n/g,'<br/>'); root.append(p);
    } else if (b.type === 'code'){
      if (b.caption){ const cap = document.createElement('div'); cap.className = 'muted'; cap.textContent = b.caption; root.append(cap); }
      const pre  = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = b.code || '';
      pre.append(code); root.append(pre);
    } else if (b.type === 'quote'){
      const q = document.createElement('blockquote');
      q.innerHTML = escapeHtml(b.text||'').replace(/\n/g,'<br/>');
      if (b.cite){ const cite = document.createElement('div'); cite.className = 'muted'; cite.textContent = '— ' + b.cite; q.append(document.createElement('br')); q.append(cite); }
      root.append(q);
    } else if (b.type === 'list'){
      const items = (b.items||'').split(/\r?\n/).filter(Boolean);
      const list  = (b.style||'ul') === 'ol' ? document.createElement('ol') : document.createElement('ul');
      items.forEach(t => { const li = document.createElement('li'); li.textContent = t; list.append(li); });
      root.append(list);
    } else if (b.type === 'divider'){
      root.append(document.createElement('hr'));
    }
  });
}

// Helpers
function clearEditor(){
  $('#title').value=''; $('#slug').value=''; $('#tags').value='';
  $('#status').value='draft'; $('#description').value='';
  $('#blocks').innerHTML=''; renderPreview();
}

async function save(){
  const data = {
    title: $('#title').value.trim() || 'Untitled',
    slug:  $('#slug').value.trim(),
    tags:  $('#tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean),
    description: $('#description').value,
    blocks: readBlocksFromUI(),
    status: $('#status').value || 'draft',
    updated: new Date().toISOString(),
    authorUid: auth.currentUser?.uid || null
  };
  if (!currentId){
    data.created = data.updated;
    const ref = await db.collection('posts').add(data);
    currentId = ref.id;
  } else {
    await db.collection('posts').doc(currentId).set(data, { merge: true });
  }
  setStatus('Saved');
  loadList();
}

async function del(){
  if (!currentId) return;
  if (!confirm('Delete this post?')) return;
  await db.collection('posts').doc(currentId).delete();
  currentId = null;
  clearEditor();
  setStatus('Deleted');
  loadList();
}

function setEditor(docId, data){
  currentId = docId;
  $('#title').value = data?.title || '';
  $('#slug').value  = data?.slug  || '';
  $('#tags').value  = (data?.tags || []).join(', ');
  $('#status').value = data?.status || 'draft';
  $('#description').value = data?.description || '';
  renderBlocks(data?.blocks || []);
  renderPreview();
}

async function loadList(){
  const q  = $('#post-search').value.trim().toLowerCase();
  const ul = $('#post-list'); ul.innerHTML = '';

  // NOTE: no orderBy here (avoids composite index). We sort in JS.
  const snap = await db.collection('posts').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  docs.sort((a,b)=> String(b.updated||'').localeCompare(String(a.updated||'')));

  docs.forEach(d => {
    if (q && !((d.title||'').toLowerCase().includes(q) || (d.tags||[]).join(',').includes(q))) return;
    const li = document.createElement('li'); li.dataset.id = d.id;
    const left = document.createElement('div');
    const t = document.createElement('div'); t.className = 'title'; t.textContent = d.title || 'Untitled';
    const s = document.createElement('div'); s.className = 'time';  s.textContent = (d.status||'draft') + ' • ' + (d.updated || '');
    left.append(t, s); li.append(left, document.createElement('div'));
    li.onclick = () => setEditor(d.id, d);
    ul.append(li);
  });
}

// boot
function bootstrap(){
  // toolbar
  document.getElementById('btn-new').onclick    = () => { currentId = null; clearEditor(); };
  document.getElementById('btn-delete').onclick = del;
  document.getElementById('btn-save').onclick   = save;
  document.getElementById('post-search').addEventListener('input', loadList);

  // add block buttons
  document.getElementById('add-text').onclick    = () => { const el = document.getElementById('tpl-block-text').content.cloneNode(true); wireBlock(el); document.getElementById('blocks').append(el); renderPreview(); };
  document.getElementById('add-code').onclick    = () => { const el = document.getElementById('tpl-block-code').content.cloneNode(true); wireBlock(el); document.getElementById('blocks').append(el); renderPreview(); };
  document.getElementById('add-quote').onclick   = () => { const el = document.getElementById('tpl-block-quote').content.cloneNode(true); wireBlock(el); document.getElementById('blocks').append(el); renderPreview(); };
  document.getElementById('add-list').onclick    = () => { const el = document.getElementById('tpl-block-list').content.cloneNode(true); wireBlock(el); document.getElementById('blocks').append(el); renderPreview(); };
  document.getElementById('add-divider').onclick = () => { const el = document.getElementById('tpl-block-divider').content.cloneNode(true); wireBlock(el); document.getElementById('blocks').append(el); renderPreview(); };

  // copy/download inside code blocks (event delegation)
  document.addEventListener('click', (e) => {
    const el = e.target;
    if (el.classList.contains('copy-code')) {
      const block = el.closest('.block');
      const txt = block.querySelector('.code-input')?.value || '';
      navigator.clipboard.writeText(txt);
      setStatus('Code copied');
    }
    if (el.classList.contains('download-code')) {
      const block = el.closest('.block');
      const txt = block.querySelector('.code-input')?.value || '';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain'}));
      a.download = (block.querySelector('.lang')?.value || 'code') + '.txt';
      a.click();
    }
  });

  // initial
  clearEditor();
  loadList();
}
