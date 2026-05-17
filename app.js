/* ── Goretti Social — app.js ── */

// ── Estado ──────────────────────────────────────────────────
let currentUser = null, currentPostId = null, postsUnsubscribe = null, adminAvatarUrl = null;
let replyingTo = null; // { commentId, authorName }

// ── Filtro lenguaje ─────────────────────────────────────────
const BAD = ['mierda','puta','puto','hijueputa','marica','gonorrea','malparido','malparida',
  'pendejo','pendeja','bastardo','culo','coño','verga','joder','coger','follar','chingar',
  'cabron','cabrona','arrecho','güevón','huevón','huevona','zorra','perra','bitch','fuck',
  'shit','damn','maricon','hdp','estupido','idiota','imbecil','hp','culero','mondá'];
function bad(t){ const n=t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return BAD.some(w=>new RegExp('\\b'+w.normalize('NFD').replace(/[\u0300-\u036f]/g,'')+'\\b','i').test(n)); }

// ── DOM utils ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show  = id => { const e=$(id); if(e) e.classList.remove('hide'); };
const hide  = id => { const e=$(id); if(e) e.classList.add('hide'); };
const modal = id => { const e=$(id); if(e) e.classList.remove('hide'); document.body.style.overflow='hidden'; };
const unmodal=id => { const e=$(id); if(e) e.classList.add('hide'); document.body.style.overflow=''; };

function toast(msg, type='info', ms=3500){
  const icons={success:'✅',error:'❌',info:'ℹ️'};
  const el=document.createElement('div'); el.className=`toast ${type}`;
  el.innerHTML=`<span>${icons[type]}</span><span>${msg}</span>`;
  $('toastContainer').appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); el.addEventListener('animationend',()=>el.remove()); },ms);
}

function fmt(ts){
  if(!ts) return '';
  const d=ts.toDate?ts.toDate():new Date(ts);
  return d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ── Config (logo + avatar) ──────────────────────────────────
function refreshConfig(){
  db.collection('config').doc('logo').get().then(d=>{
    if(d.exists&&d.data().url){ const l=$('appLogo'); if(l){l.src=d.data().url;l.style.display='block';} }
  }).catch(()=>{});
  db.collection('config').doc('adminAvatar').get().then(d=>{
    if(d.exists&&d.data().url) adminAvatarUrl=d.data().url;
  }).catch(()=>{});
}

// ── Auth ────────────────────────────────────────────────────
auth.onAuthStateChanged(user=>{
  currentUser=user;
  if(user){
    hide('btnShowLogin'); show('btnLogout'); show('adminBadge'); show('adminToolbar');
    document.body.classList.add('admin-mode');
  } else {
    show('btnShowLogin'); hide('btnLogout'); hide('adminBadge'); hide('adminToolbar');
    document.body.classList.remove('admin-mode');
  }
  loadFeed();
});

$('btnShowLogin').onclick=()=>modal('modalLogin');
$('btnCloseLogin').onclick=()=>unmodal('modalLogin');
$('togglePass').onclick=()=>{ const i=$('loginPass'); i.type=i.type==='password'?'text':'password'; };
$('loginForm').onsubmit=async e=>{
  e.preventDefault();
  if($('loginUser').value.trim().toLowerCase()!=='contralora'){ toast('Solo la Contralora puede entrar','error'); return; }
  const btn=$('btnLogin'); btn.disabled=true; btn.textContent='Ingresando…';
  try{
    await auth.signInWithEmailAndPassword('admin@goretti.edu.co',$('loginPass').value);
    unmodal('modalLogin'); $('loginForm').reset(); toast('¡Bienvenida Contralora Gabriela! 👑','success');
  }catch{ toast('Usuario o contraseña incorrectos','error'); }
  finally{ btn.disabled=false; btn.textContent='Ingresar'; }
};
$('btnLogout').onclick=()=>{ auth.signOut(); toast('Sesión cerrada','info'); };

// ── Feed ────────────────────────────────────────────────────
function loadFeed(){
  if(postsUnsubscribe) postsUnsubscribe();
  show('loadingFeed'); hide('emptyFeed'); $('postsContainer').innerHTML='';
  postsUnsubscribe=db.collection('posts').orderBy('date','desc').onSnapshot(snap=>{
    hide('loadingFeed');
    if(snap.empty){ show('emptyFeed'); $('postsContainer').innerHTML=''; return; }
    hide('emptyFeed');
    snap.docChanges().forEach(change=>{
      const {doc}=change;
      if(change.type==='added'){
        const el=renderPost(doc.id,doc.data());
        const container=$('postsContainer');
        const children=container.children;
        if(change.newIndex<children.length) container.insertBefore(el,children[change.newIndex]);
        else container.appendChild(el);
      } else if(change.type==='modified'){
        updatePostCard(doc.id,doc.data());
      } else if(change.type==='removed'){
        const el=document.querySelector(`.post-card[data-id="${doc.id}"]`);
        if(el) el.remove();
      }
    });
  },()=>{ hide('loadingFeed'); toast('Error al cargar','error'); });
}

function updatePostCard(id,data){
  const card=document.querySelector(`.post-card[data-id="${id}"]`);
  if(!card) return;
  const liked=localStorage.getItem('liked_'+id)==='1';
  const lc=card.querySelector('.like-count');
  if(lc) lc.textContent=data.likes||0;
  const btnLike=card.querySelector('.btn-like');
  if(btnLike){
    btnLike.classList.toggle('liked',liked);
    const svg=btnLike.querySelector('svg');
    if(svg) svg.setAttribute('fill',liked?'currentColor':'none');
  }

}

function renderPost(id,data){
  const div=document.createElement('div'); div.className='post-card'; div.dataset.id=id;
  const isA=!!currentUser;
  const av=adminAvatarUrl
    ?`<div class="post-avatar"><img src="${adminAvatarUrl}" alt="Admin"></div>`
    :`<div class="post-avatar">👑</div>`;
  let media='';
  if(data.mediaData&&data.mediaType){
    if(data.mediaType.startsWith('image/')) media=`<img class="post-media" src="${data.mediaData}" alt="" loading="lazy">`;
    else if(data.mediaType==='video/mp4') media=`<video class="post-media-video" controls src="${data.mediaData}"></video>`;
    else if(data.mediaType==='application/pdf') media=`<a class="post-pdf-link" href="${data.mediaData}" target="_blank">📄 Ver PDF</a>`;
  }
  const likes=data.likes||0, cc=data.commentCount||0, liked=localStorage.getItem('liked_'+id)==='1';
  div.innerHTML=`
    <div class="post-header">
      <div class="post-author-row">${av}
        <div class="post-meta">
          <span class="post-author">👑 Contralora Gabriela Becerra</span>
          <span class="post-date">${fmt(data.date)}</span>
        </div>
      </div>
      ${isA?`<div class="post-admin-actions">
        <button class="btn-post-admin btn-post-edit" title="Editar">✏️</button>
        <button class="btn-post-admin btn-post-delete" title="Eliminar">🗑️</button>
      </div>`:''}
    </div>
    ${media}
    <div class="post-body">
      <div class="post-title">${data.title||''}</div>
      <div class="post-text">${(data.body||'').replace(/</g,'&lt;')}</div>
    </div>
    <div class="post-actions">
      <button class="btn-post-action btn-like${liked?' liked':''}">
        <svg viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="like-count">${likes}</span>
      </button>

    </div>`;
  div.querySelector('.btn-like').onclick=()=>toggleLike(id,div);
  if(isA){
    div.querySelector('.btn-post-edit').onclick=()=>openEditPost(id,data);
    div.querySelector('.btn-post-delete').onclick=()=>deletePost(id);
  }
  return div;
}

async function toggleLike(pid,card){
  const btnLike=card.querySelector('.btn-like');
  const likeCount=card.querySelector('.like-count');
  const wasLiked=localStorage.getItem('liked_'+pid)==='1';
  const nowLiked=!wasLiked;
  // Optimistic UI
  btnLike.classList.toggle('liked',nowLiked);
  btnLike.querySelector('svg').setAttribute('fill',nowLiked?'currentColor':'none');
  const cur=parseInt(likeCount.textContent)||0;
  likeCount.textContent=nowLiked?cur+1:Math.max(0,cur-1);
  localStorage.setItem('liked_'+pid,nowLiked?'1':'0');
  try{
    await db.collection('posts').doc(pid).update({likes:firebase.firestore.FieldValue.increment(nowLiked?1:-1)});
  }catch{
    // Revert on error
    btnLike.classList.toggle('liked',wasLiked);
    btnLike.querySelector('svg').setAttribute('fill',wasLiked?'currentColor':'none');
    likeCount.textContent=cur;
    localStorage.setItem('liked_'+pid,wasLiked?'1':'0');
    toast('Error al dar like','error');
  }
}

// ── New Post ────────────────────────────────────────────────
$('btnNewPost').onclick=()=>modal('modalNewPost');
$('btnCloseNewPost').onclick=()=>{ unmodal('modalNewPost'); $('postForm').reset(); hide('filePreview'); };
$('btnCancelPost').onclick=()=>{ unmodal('modalNewPost'); $('postForm').reset(); hide('filePreview'); };

const dz=$('dropZone');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
dz.addEventListener('drop',e=>{ e.preventDefault();dz.classList.remove('drag-over');
  if(e.dataTransfer.files[0]) prevFile(e.dataTransfer.files[0],$('postMedia'),'filePreview'); });
$('postMedia').onchange=e=>{ if(e.target.files[0]) prevFile(e.target.files[0],$('postMedia'),'filePreview'); };

function prevFile(f,inp,pid){
  if(f.size>4.5*1024*1024){toast('Archivo supera 4MB','error');inp.value='';return;}
  const p=$(pid); p.innerHTML=''; show(pid);
  if(f.type.startsWith('image/')){const i=document.createElement('img');i.src=URL.createObjectURL(f);p.appendChild(i);}
  else p.innerHTML=`<div class="preview-name">📄 ${f.name}</div>`;
}
const b64=f=>new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.onerror=j;rd.readAsDataURL(f);});
function compress(f,w=1200,q=0.8){return new Promise(r=>{
  const img=new Image(),u=URL.createObjectURL(f);
  img.onload=()=>{const s=Math.min(1,w/img.width),cv=document.createElement('canvas');
    cv.width=img.width*s;cv.height=img.height*s;cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    URL.revokeObjectURL(u);r(cv.toDataURL('image/jpeg',q));};img.src=u;});}

$('postForm').onsubmit=async e=>{
  e.preventDefault();
  const t=$('postTitle').value.trim(),b=$('postBody').value.trim(),f=$('postMedia').files[0];
  if(!t||!b){toast('Completa título y contenido','error');return;}
  const btn=$('btnSubmitPost'); btn.disabled=true; btn.textContent='Publicando…';
  try{
    let md=null,mt=null;
    if(f){mt=f.type;md=f.type.startsWith('image/')?await compress(f):await b64(f);}
    await db.collection('posts').add({title:t,body:b,author:'Contralora Gabriela Becerra',likes:0,commentCount:0,
      date:firebase.firestore.FieldValue.serverTimestamp(),mediaData:md,mediaType:mt});
    unmodal('modalNewPost');$('postForm').reset();hide('filePreview');toast('¡Publicado! 🎉','success');
  }catch(err){toast('Error: '+err.message,'error');}
  finally{btn.disabled=false;btn.textContent='Publicar';}
};

// ── Edit Post ───────────────────────────────────────────────
$('btnCloseEditPost').onclick=()=>unmodal('modalEditPost');
$('btnCancelEdit').onclick=()=>unmodal('modalEditPost');
function openEditPost(id,data){$('editPostId').value=id;$('editPostTitle').value=data.title||'';$('editPostBody').value=data.body||'';modal('modalEditPost');}
$('editPostForm').onsubmit=async e=>{
  e.preventDefault();
  const id=$('editPostId').value,t=$('editPostTitle').value.trim(),b=$('editPostBody').value.trim();
  if(!t||!b){toast('Completa los campos','error');return;}
  const btn=$('btnSubmitEdit');btn.disabled=true;btn.textContent='Guardando…';
  try{await db.collection('posts').doc(id).update({title:t,body:b});unmodal('modalEditPost');toast('Actualizado ✅','success');}
  catch(err){toast('Error: '+err.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar cambios';}
};

async function deletePost(id){
  if(!confirm('¿Eliminar esta publicación?')) return;
  try{
    const cs=await db.collection('posts').doc(id).collection('comments').get();
    const bt=db.batch(); cs.forEach(d=>bt.delete(d.ref)); bt.delete(db.collection('posts').doc(id)); await bt.commit();
    toast('Eliminada','info');
  }catch(err){toast('Error: '+err.message,'error');}
}

// ── Comments Bottom Sheet ───────────────────────────────────
$('btnCloseSheet').onclick=closeSheet;
$('commentsBackdrop').onclick=closeSheet;
$('btnCancelReply').onclick=cancelReply;

function openSheet(){$('commentsBackdrop').classList.remove('hide');$('commentsSheet').classList.add('open');document.body.style.overflow='hidden';}
function closeSheet(){$('commentsSheet').classList.remove('open');$('commentsBackdrop').classList.add('hide');document.body.style.overflow='';currentPostId=null;cancelReply();}

function showReplyIndicator(commentId,authorName){
  replyingTo={commentId,authorName};
  $('replyIndicator').style.display='flex';
  $('replyIndicatorName').textContent=authorName;
  $('commentTextSheet').focus();
}
function cancelReply(){
  replyingTo=null;
  $('replyIndicator').style.display='none';
}

async function openComments(pid){
  currentPostId=pid; cancelReply();
  $('commentsListSheet').innerHTML='<div class="sheet-no-comments">⏳ Cargando…</div>';
  const sv=localStorage.getItem('visitorName')||'';
  if(!currentUser){
    $('commentNameSheet').value=sv; $('commentNameSheet').style.display='';
    $('commenterAvatar').style.display='none'; $('commenterAvatarInitial').style.display='flex';
  } else {
    $('commentNameSheet').value='Admin'; $('commentNameSheet').style.display='none';
    if(adminAvatarUrl){$('commenterAvatar').src=adminAvatarUrl;$('commenterAvatar').style.display='block';$('commenterAvatarInitial').style.display='none';}
  }
  openSheet(); renderSheet(pid);
}

async function renderSheet(pid){
  const list=$('commentsListSheet');
  try{
    const snap=await db.collection('posts').doc(pid).collection('comments').orderBy('date','asc').get();
    $('sheetCommentsTitle').textContent=snap.size>0?`${snap.size} comentario${snap.size!==1?'s':''}`:'Comentarios';
    list.innerHTML='';
    if(snap.empty){list.innerHTML='<div class="sheet-no-comments">💬 Sé el primero en comentar</div>';return;}
    // Organizar top-level y respuestas
    const topLevel=[]; const repliesMap=new Map();
    snap.forEach(doc=>{
      const c=doc.data();
      if(!c.parentId) topLevel.push({id:doc.id,data:c});
      else{ if(!repliesMap.has(c.parentId)) repliesMap.set(c.parentId,[]); repliesMap.get(c.parentId).push({id:doc.id,data:c}); }
    });
    topLevel.forEach(({id,data})=>{
      list.appendChild(buildCommentEl(pid,id,data,false,null));
      (repliesMap.get(id)||[]).forEach(({id:rid,data:rd})=>list.appendChild(buildCommentEl(pid,rid,rd,true,data.author)));
    });
    list.scrollTop=list.scrollHeight;
  }catch{list.innerHTML='<div class="sheet-no-comments">Error al cargar</div>';}
}

function buildCommentEl(pid,docId,c,isReply,parentAuthor){
  const isA=c.author==='Admin';
  const av=isA&&adminAvatarUrl
    ?`<div class="sheet-comment-avatar"><img src="${adminAvatarUrl}" alt="A"></div>`
    :`<div class="sheet-comment-avatar">${isA?'👑':c.author.charAt(0).toUpperCase()}</div>`;
  const cl=c.likes||0;
  const el=document.createElement('div'); el.className='sheet-comment'+(isReply?' reply':'');
  el.innerHTML=`${av}
    <div class="sheet-comment-content">
      ${isReply?`<span class="reply-to-label">↩ ${parentAuthor}</span>`:''}
      <span class="sheet-comment-author${isA?' is-admin':''}">${isA?'👑 Admin':c.author}</span>
      <div class="sheet-comment-text">${(c.text||'').replace(/</g,'&lt;')}</div>
      <div class="sheet-comment-meta">
        <span class="sheet-comment-date">${fmt(c.date)}</span>
        <button class="btn-clike${localStorage.getItem('cliked_'+docId)==='1'?' liked':''}">❤️ ${cl>0?`<span>${cl}</span>`:''}</button>
        <button class="btn-reply-comment">↩ Responder</button>
        ${currentUser?`<button class="btn-del-sheet-comment" data-cid="${docId}">🗑</button>`:''}
      </div>
    </div>`;
  el.querySelector('.btn-clike').onclick=async()=>{
    const ck=localStorage.getItem('cliked_'+docId)==='1';
    await db.collection('posts').doc(pid).collection('comments').doc(docId)
      .update({likes:firebase.firestore.FieldValue.increment(ck?-1:1)});
    localStorage.setItem('cliked_'+docId,ck?'0':'1'); renderSheet(pid);
  };
  el.querySelector('.btn-reply-comment').onclick=()=>showReplyIndicator(docId,c.author);
  if(currentUser) el.querySelector('.btn-del-sheet-comment').onclick=async()=>{
    try{
      const batch=db.batch();
      batch.delete(db.collection('posts').doc(pid).collection('comments').doc(docId));
      // borrar también respuestas hijas
      const kids=await db.collection('posts').doc(pid).collection('comments').where('parentId','==',docId).get();
      let count=1; kids.forEach(d=>{batch.delete(d.ref);count++;});
      await batch.commit();
      await db.collection('posts').doc(pid).update({commentCount:firebase.firestore.FieldValue.increment(-count)});
      renderSheet(pid); toast('Comentario eliminado','info');
    }catch(err){toast('Error: '+err.message,'error');}
  };
  return el;
}

$('btnPostComment').onclick=async()=>{
  const name=$('commentNameSheet').value.trim(), text=$('commentTextSheet').value.trim();
  if(!currentUser&&!name){toast('Escribe tu nombre','error');$('commentNameSheet').focus();return;}
  if(!text){toast('Escribe un comentario','error');$('commentTextSheet').focus();return;}
  if(bad(text)){toast('❌ Lenguaje inapropiado. Sé respetuoso.','error');return;}
  if(!currentUser) localStorage.setItem('visitorName',name);
  const btn=$('btnPostComment'); btn.disabled=true;
  try{
    const commentData={author:currentUser?'Admin':name,text,likes:0,date:firebase.firestore.FieldValue.serverTimestamp()};
    if(replyingTo) commentData.parentId=replyingTo.commentId;
    await db.collection('posts').doc(currentPostId).collection('comments').add(commentData);
    await db.collection('posts').doc(currentPostId).update({commentCount:firebase.firestore.FieldValue.increment(1)});
    $('commentTextSheet').value=''; cancelReply(); renderSheet(currentPostId); toast('Comentario publicado 💬','success');
  }catch(err){toast('Error: '+err.message,'error');}
  finally{btn.disabled=false;}
};

// ── Send Message ────────────────────────────────────────────
$('fabMessage').onclick=()=>modal('modalMessage');
$('btnCloseMessage').onclick=()=>unmodal('modalMessage');
$('btnCancelMessage').onclick=()=>unmodal('modalMessage');
const _sv=localStorage.getItem('visitorName')||''; if(_sv&&$('msgSender')) $('msgSender').value=_sv;
$('messageForm').onsubmit=async e=>{
  e.preventDefault();
  const s=$('msgSender').value.trim(),su=$('msgSubject').value.trim(),b=$('msgBody').value.trim(),an=$('msgAnon').checked;
  if(!s||!su||!b){toast('Completa todos los campos','error');return;}
  if(bad(b)){toast('Lenguaje inapropiado. Sé respetuoso.','error');return;}
  localStorage.setItem('visitorName',s);
  const btn=$('btnSubmitMessage');btn.disabled=true;btn.textContent='Enviando…';
  try{
    await db.collection('messages').add({sender:an?'Anónimo':s,subject:su,body:b,anonymous:an,read:false,
      date:firebase.firestore.FieldValue.serverTimestamp()});
    unmodal('modalMessage');$('messageForm').reset();toast('¡Mensaje enviado! 📬','success');loadUnread();
  }catch(err){toast('Error: '+err.message,'error');}
  finally{btn.disabled=false;btn.textContent='Enviar mensaje';}
};

// ── Logo ────────────────────────────────────────────────────
$('btnChangeLogo').onclick=()=>modal('modalLogo');
$('btnCloseLogo').onclick=()=>unmodal('modalLogo');
$('btnCancelLogo').onclick=()=>unmodal('modalLogo');
$('logoFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const p=$('logoPreview'),i=document.createElement('img');i.src=URL.createObjectURL(f);p.innerHTML='';p.appendChild(i);};
$('btnSaveLogo').onclick=async()=>{
  const f=$('logoFile').files[0];if(!f){toast('Selecciona imagen','error');return;}
  const btn=$('btnSaveLogo');btn.disabled=true;btn.textContent='Guardando…';
  try{
    const d=await compress(f,300,0.9);
    await db.collection('config').doc('logo').set({url:d});
    $('appLogo').src=d;$('appLogo').style.display='block';
    unmodal('modalLogo');toast('Logo actualizado ✅','success');
  }catch(err){toast('Error: '+err.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar logo';}
};

// ── Avatar ──────────────────────────────────────────────────
$('btnChangeAvatar').onclick=()=>{
  if(adminAvatarUrl){$('avatarPreviewImg').src=adminAvatarUrl;$('avatarPreviewImg').style.display='block';$('avatarPreviewInitial').style.display='none';}
  modal('modalAvatar');
};
$('btnCloseAvatar').onclick=()=>unmodal('modalAvatar');
$('btnCancelAvatar').onclick=()=>unmodal('modalAvatar');
$('avatarFile').onchange=e=>{const f=e.target.files[0];if(!f)return;$('avatarPreviewImg').src=URL.createObjectURL(f);$('avatarPreviewImg').style.display='block';$('avatarPreviewInitial').style.display='none';};
$('btnSaveAvatar').onclick=async()=>{
  const f=$('avatarFile').files[0];if(!f){toast('Selecciona imagen','error');return;}
  const btn=$('btnSaveAvatar');btn.disabled=true;btn.textContent='Guardando…';
  try{
    const d=await compress(f,200,0.9);
    await db.collection('config').doc('adminAvatar').set({url:d});
    adminAvatarUrl=d;unmodal('modalAvatar');toast('Foto actualizada ✅','success');loadFeed();
  }catch(err){toast('Error: '+err.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar foto';}
};

// ── Init ────────────────────────────────────────────────────
refreshConfig();