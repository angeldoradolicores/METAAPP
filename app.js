/* ══════════════════════════════════════════════════════════
   app.js — Goretti Social
   Firebase Firestore + Auth
══════════════════════════════════════════════════════════ */

// ─── Estado Global ───────────────────────────────────────
let currentUser  = null;
let currentPostId = null;
let postsUnsubscribe = null;
let adminAvatarUrl = null;  // Foto de perfil del admin

// ─── Palabras Prohibidas (filtro de lenguaje) ─────────────
const BANNED_WORDS = [
  "mierda","puta","puto","hijueputa","hijueputo","marica","gonorrea",
  "malparido","malparida","hp","idiota","imbecil","imbécil","estupido",
  "estúpido","estupida","estúpida","pendejo","pendeja","bastardo",
  "bastarda","culero","culear","culo","coño","verga","pene","vagina",
  "joder","coger","follar","chingar","cabron","cabrón","cabrona",
  "arrecho","arrechera","mondá","mondá","mondarsela","güevón","huevón",
  "huevona","gonorrea","berriondo","cachón","zorra","perra","bitch",
  "fuck","shit","ass","damn","crap","sexy","putisima","putísima",
  "maricon","maricón","maricona","sapo","sapos","plaga","hdp"
];

function containsBannedWord(text) {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return BANNED_WORDS.some(w => {
    const wn = w.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const regex = new RegExp(`\\b${wn}\\b`, "i");
    return regex.test(lower);
  });
}

// ─── Toast Notifications ──────────────────────────────────
function toast(msg, type = "info", duration = 3500) {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const container = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove());
  }, duration);
}

// ─── Utilidades DOM ──────────────────────────────────────
function $(id) { return document.getElementById(id); }
function show(id) { const e = $(id); if (e) e.classList.remove("hide"); }
function hide(id) { const e = $(id); if (e) e.classList.add("hide"); }
function showOverlay(id) { const e = $(id); if (e) e.classList.remove("hide"); document.body.style.overflow = "hidden"; }
function hideOverlay(id) { const e = $(id); if (e) e.classList.add("hide"); document.body.style.overflow = ""; }

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ─── Logo & Avatar ────────────────────────────────────────
function refreshLogo() {
  db.collection("config").doc("logo").get().then(doc => {
    if (doc.exists && doc.data().url) {
      const logo = $("appLogo");
      if (logo) { logo.src = doc.data().url; logo.style.display = "block"; }
      const ml = document.querySelector(".modal-logo");
      if (ml) { ml.src = doc.data().url; ml.style.display = "block"; }
    }
  }).catch(() => {});
  // Load admin avatar
  db.collection("config").doc("adminAvatar").get().then(doc => {
    if (doc.exists && doc.data().url) {
      adminAvatarUrl = doc.data().url;
    }
  }).catch(() => {});
}

// ─── Auth State ───────────────────────────────────────────
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    // Admin logged in
    hide("btnShowLogin");
    show("btnLogout");
    show("adminBadge");
    show("adminToolbar");
    document.body.classList.add("admin-mode");
    hide("fabMessage");
    loadUnreadCount();
  } else {
    show("btnShowLogin");
    hide("btnLogout");
    hide("adminBadge");
    hide("adminToolbar");
    document.body.classList.remove("admin-mode");
    show("fabMessage");
  }
  loadFeed();
});

// ─── Login ────────────────────────────────────────────────
$("btnShowLogin").onclick = () => showOverlay("modalLogin");
$("btnCloseLogin").onclick = () => hideOverlay("modalLogin");

$("togglePass").onclick = () => {
  const inp = $("loginPass");
  inp.type = inp.type === "password" ? "text" : "password";
};

$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const username = $("loginUser").value.trim();
  const pass     = $("loginPass").value;
  if (username !== "admin") {
    toast("Solo el administrador puede iniciar sesión", "error"); return;
  }
  const btn = $("btnLogin");
  btn.disabled = true;
  btn.textContent = "Ingresando…";
  try {
    // Map "admin" to the Firebase Auth email
    await auth.signInWithEmailAndPassword("admin@goretti.edu.co", pass);
    hideOverlay("modalLogin");
    $("loginForm").reset();
    toast("¡Bienvenido, Administrador! 👑", "success");
  } catch {
    toast("Usuario o contraseña incorrectos", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
};

$("btnLogout").onclick = () => {
  auth.signOut();
  toast("Sesión cerrada", "info");
};

// ─── Feed ─────────────────────────────────────────────────
function loadFeed() {
  if (postsUnsubscribe) postsUnsubscribe();
  show("loadingFeed");
  hide("emptyFeed");
  $("postsContainer").innerHTML = "";

  postsUnsubscribe = db.collection("posts")
    .orderBy("date", "desc")
    .onSnapshot(snapshot => {
      hide("loadingFeed");
      $("postsContainer").innerHTML = "";
      if (snapshot.empty) { show("emptyFeed"); return; }
      hide("emptyFeed");
      snapshot.forEach(doc => renderPost(doc.id, doc.data()));
    }, () => {
      hide("loadingFeed");
      toast("Error al cargar el feed", "error");
    });
}

function renderPost(id, data) {
  const container = $('postsContainer');
  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.id = id;
  const isAdmin = !!currentUser;

  // Avatar: imagen real si existe, si no inicial
  const avatarHtml = adminAvatarUrl
    ? `<div class="post-avatar"><img src="${adminAvatarUrl}" alt="Admin"></div>`
    : `<div class="post-avatar">👑</div>`;

  let mediaHtml = '';
  if (data.mediaData && data.mediaType) {
    if (data.mediaType.startsWith('image/')) {
      mediaHtml = `<img class="post-media" src="${data.mediaData}" alt="${data.title}" loading="lazy">`;
    } else if (data.mediaType === 'video/mp4') {
      mediaHtml = `<video class="post-media-video" controls src="${data.mediaData}"></video>`;
    } else if (data.mediaType === 'application/pdf') {
      mediaHtml = `<a class="post-pdf-link" href="${data.mediaData}" target="_blank">📄 Ver PDF adjunto</a>`;
    }
  }

  const adminBtns = isAdmin ? `
    <div class="post-admin-actions">
      <button class="btn-post-admin btn-post-edit" title="Editar">✏️</button>
      <button class="btn-post-admin btn-post-delete" title="Eliminar">🗑️</button>
    </div>` : '';

  const likes    = data.likes || 0;
  const comments = data.commentCount || 0;
  const likedKey = `liked_${id}`;
  const liked    = localStorage.getItem(likedKey) === '1';

  card.innerHTML = `
    <div class="post-header">
      <div class="post-author-row">
        ${avatarHtml}
        <div class="post-meta">
          <span class="post-author">👑 ${data.author || 'Admin'}</span>
          <span class="post-date">${formatDate(data.date)}</span>
        </div>
      </div>
      ${adminBtns}
    </div>
    ${mediaHtml}
    <div class="post-body">
      <div class="post-title">${data.title || ''}</div>
      <div class="post-text">${(data.body || '').replace(/</g,'&lt;')}</div>
    </div>
    <div class="post-actions">
      <button class="btn-post-action btn-like ${liked ? 'liked' : ''}">
        <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="like-count">${likes}</span>
      </button>
      <button class="btn-post-action btn-comment">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="action-count">${comments > 0 ? comments : ''}</span>
        Comentarios
      </button>
    </div>`;

  container.appendChild(card);
  card.querySelector('.btn-like').onclick    = () => toggleLike(id, liked);
  card.querySelector('.btn-comment').onclick = () => openComments(id);
  if (isAdmin) {
    card.querySelector('.btn-post-edit').onclick   = () => openEditPost(id, data);
    card.querySelector('.btn-post-delete').onclick = () => deletePost(id);
  }
}

// ─── Likes (Firestore increment atómico) ──────────────────
async function toggleLike(postId, isLiked) {
  const key = `liked_${postId}`;
  try {
    await db.collection('posts').doc(postId).update({
      likes: firebase.firestore.FieldValue.increment(isLiked ? -1 : 1)
    });
    localStorage.setItem(key, isLiked ? '0' : '1');
  } catch { toast('No se pudo registrar el like', 'error'); }
}

// ─── New Post ─────────────────────────────────────────────
$("btnNewPost").onclick = () => showOverlay("modalNewPost");
$("btnCloseNewPost").onclick = () => { hideOverlay("modalNewPost"); $("postForm").reset(); hide("filePreview"); };
$("btnCancelPost").onclick   = () => { hideOverlay("modalNewPost"); $("postForm").reset(); hide("filePreview"); };

// File drag & drop
const dropZone = $("dropZone");
dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFilePreview(file, $("postMedia"), $("filePreview"));
});
$("postMedia").onchange = (e) => {
  if (e.target.files[0]) handleFilePreview(e.target.files[0], $("postMedia"), $("filePreview"));
};

function handleFilePreview(file, input, previewEl) {
  if (file.size > 4.5 * 1024 * 1024) {
    toast("El archivo supera 4MB. Por favor elige uno más pequeño.", "error");
    input.value = ""; return;
  }
  const prevDiv = previewEl;
  prevDiv.innerHTML = "";
  show(prevDiv.id);
  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    prevDiv.appendChild(img);
  } else {
    prevDiv.innerHTML = `<div class="preview-name">📄 ${file.name}</div>`;
  }
}

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(file, maxW = 1200, quality = 0.8) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = url;
  });
}

$("postForm").onsubmit = async (e) => {
  e.preventDefault();
  const title  = $("postTitle").value.trim();
  const body   = $("postBody").value.trim();
  const file   = $("postMedia").files[0];
  if (!title || !body) { toast("El título y contenido son obligatorios", "error"); return; }

  const btn = $("btnSubmitPost");
  btn.disabled = true; btn.textContent = "Publicando…";

  try {
    let mediaData = null, mediaType = null;
    if (file) {
      mediaType = file.type;
      if (file.type.startsWith("image/")) {
        mediaData = await compressImage(file);
      } else {
        mediaData = await readFileAsBase64(file);
      }
    }
    await db.collection("posts").add({
      title, body,
      author: "Admin",
      date: firebase.firestore.FieldValue.serverTimestamp(),
      likes: 0,
      commentCount: 0,
      mediaData: mediaData || null,
      mediaType: mediaType || null
    });
    hideOverlay("modalNewPost");
    $("postForm").reset();
    hide("filePreview");
    toast("¡Publicación creada! 🎉", "success");
  } catch (err) {
    toast("Error al publicar: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "Publicar";
  }
};

// ─── Edit Post ────────────────────────────────────────────
$("btnCloseEditPost").onclick = () => hideOverlay("modalEditPost");
$("btnCancelEdit").onclick    = () => hideOverlay("modalEditPost");

function openEditPost(id, data) {
  $("editPostId").value    = id;
  $("editPostTitle").value = data.title || "";
  $("editPostBody").value  = data.body  || "";
  showOverlay("modalEditPost");
}

$("editPostForm").onsubmit = async (e) => {
  e.preventDefault();
  const id    = $("editPostId").value;
  const title = $("editPostTitle").value.trim();
  const body  = $("editPostBody").value.trim();
  if (!title || !body) { toast("Completa todos los campos", "error"); return; }
  const btn = $("btnSubmitEdit");
  btn.disabled = true; btn.textContent = "Guardando…";
  try {
    await db.collection("posts").doc(id).update({ title, body });
    hideOverlay("modalEditPost");
    toast("Publicación actualizada ✅", "success");
  } catch (err) {
    toast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "Guardar cambios";
  }
};

// ─── Delete Post ──────────────────────────────────────────
async function deletePost(id) {
  if (!confirm("¿Seguro que deseas eliminar esta publicación? Esta acción no se puede deshacer.")) return;
  try {
    // Delete comments too
    const comments = await db.collection("posts").doc(id).collection("comments").get();
    const batch = db.batch();
    comments.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection("posts").doc(id));
    await batch.commit();
    toast("Publicación eliminada", "info");
  } catch (err) {
    toast("Error al eliminar: " + err.message, "error");
  }
}

// ─── Comments — Bottom Sheet estilo Instagram ─────────────
function openSheet() {
  const sheet    = $('commentsSheet');
  const backdrop = $('commentsBackdrop');
  backdrop.classList.remove('hide');
  sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  const sheet    = $('commentsSheet');
  const backdrop = $('commentsBackdrop');
  sheet.classList.remove('open');
  backdrop.classList.add('hide');
  document.body.style.overflow = '';
  currentPostId = null;
}

$('btnCloseSheet').onclick  = closeSheet;
$('commentsBackdrop').onclick = closeSheet;

async function openComments(postId) {
  currentPostId = postId;
  const list = $('commentsListSheet');
  list.innerHTML = `<div class="sheet-no-comments">⏳ Cargando…</div>`;

  // Pre-fill visitor name
  const savedName = localStorage.getItem('visitorName') || '';
  if (!currentUser) {
    $('commentNameSheet').value = savedName;
    $('commentNameSheet').style.display = '';
  } else {
    // Admin: hide name field, show "Admin"
    $('commentNameSheet').value = 'Admin';
    $('commentNameSheet').style.display = 'none';
    // Show admin avatar in input bar
    if (adminAvatarUrl) {
      $('commenterAvatar').src = adminAvatarUrl;
      $('commenterAvatar').style.display = 'block';
      $('commenterAvatarInitial').style.display = 'none';
    }
  }

  openSheet();
  renderSheetComments(postId);
}

async function renderSheetComments(postId) {
  const list = $('commentsListSheet');
  // Update title with count
  try {
    const snap = await db.collection('posts').doc(postId)
      .collection('comments').orderBy('date', 'asc').get();

    // Update count on post card
    const card = document.querySelector(`.post-card[data-id="${postId}"]`);
    if (card) {
      const countEl = card.querySelector('.action-count');
      if (countEl) countEl.textContent = snap.size > 0 ? snap.size : '';
    }
    $('sheetCommentsTitle').textContent = snap.size > 0
      ? `${snap.size} comentario${snap.size !== 1 ? 's' : ''}`
      : 'Comentarios';

    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = `<div class="sheet-no-comments">Sé el primero en comentar 💬</div>`;
      return;
    }
    snap.forEach(doc => {
      const c   = doc.data();
      const isA = c.author === 'Admin';
      const avatarHtml = isA && adminAvatarUrl
        ? `<div class="sheet-comment-avatar"><img src="${adminAvatarUrl}" alt="Admin"></div>`
        : `<div class="sheet-comment-avatar">${isA ? '👑' : c.author.charAt(0).toUpperCase()}</div>`;
      const delBtn = currentUser
        ? `<button class="btn-del-sheet-comment" data-cid="${doc.id}">× Eliminar</button>`
        : '';
      const el = document.createElement('div');
      el.className = 'sheet-comment';
      el.innerHTML = `
        ${avatarHtml}
        <div class="sheet-comment-content">
          <span class="sheet-comment-author${isA ? ' is-admin' : ''}">${isA ? '👑 Admin' : c.author}</span>
          <div class="sheet-comment-text">${(c.text||'').replace(/</g,'&lt;')}</div>
          <div class="sheet-comment-date">
            ${formatDate(c.date)}
            ${delBtn}
          </div>
        </div>`;
      list.appendChild(el);
      if (currentUser) {
        el.querySelector('.btn-del-sheet-comment').onclick = async (e) => {
          const cid = e.currentTarget.dataset.cid;
          await db.collection('posts').doc(postId).collection('comments').doc(cid).delete();
          // Decrement count
          await db.collection('posts').doc(postId).update({
            commentCount: firebase.firestore.FieldValue.increment(-1)
          });
          renderSheetComments(postId);
          toast('Comentario eliminado', 'info');
        };
      }
    });
    list.scrollTop = list.scrollHeight;
  } catch (err) {
    list.innerHTML = `<div class="no-comments">Error al cargar comentarios</div>`;
  }
}

$("btnSendComment").onclick = async () => {
  const name = $("commentName").value.trim();
  const text = $("commentText").value.trim();

  if (!name) { toast("Por favor escribe tu nombre", "error"); return; }
  if (!text) { toast("Escribe un comentario antes de enviar", "error"); return; }

  // Language filter
  if (containsBannedWord(text)) {
    toast("❌ Tu comentario contiene lenguaje inapropiado. Por favor sé respetuoso.", "error");
    return;
  }

  // Save visitor name
  localStorage.setItem("visitorName", name);

  const btn = $("btnSendComment");
  btn.disabled = true; btn.textContent = "Enviando…";
  try {
    const authorName = currentUser ? "Admin" : name;
    await db.collection("posts").doc(currentPostId).collection("comments").add({
      author: authorName,
      text,
      date: firebase.firestore.FieldValue.serverTimestamp()
    });
    $("commentText").value = "";
    renderComments(currentPostId);
    toast("Comentario enviado 💬", "success");
  } catch (err) {
    toast("Error al enviar: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "Enviar comentario";
  }
};

// ─── Inbox ────────────────────────────────────────────────
$("btnInbox").onclick = () => {
  hide("feedSection");
  show("inboxSection");
  loadInbox();
};
$("btnBackInbox").onclick = () => {
  hide("inboxSection");
  show("feedSection");
};

async function loadUnreadCount() {
  try {
    const snap = await db.collection("messages").where("read", "==", false).get();
    const badge = $("unreadBadge");
    if (snap.size > 0) {
      badge.textContent = snap.size;
      show("unreadBadge");
    } else {
      hide("unreadBadge");
    }
  } catch {}
}

async function loadInbox() {
  const list = $("inboxList");
  list.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando mensajes…</p></div>`;
  hide("emptyInbox");
  try {
    const snap = await db.collection("messages").orderBy("date", "desc").get();
    list.innerHTML = "";
    if (snap.empty) { show("emptyInbox"); return; }
    snap.forEach(doc => {
      const m = doc.data();
      const card = document.createElement("div");
      card.className = `msg-card${m.read ? "" : " unread"}`;
      const anonTag = m.anonymous ? `<span class="msg-anon-tag">Anónimo</span>` : "";
      card.innerHTML = `
        <div class="msg-sender">${m.sender || "Anónimo"}${anonTag}</div>
        <div class="msg-subject">${m.subject || ""}</div>
        <div class="msg-body">${(m.body || "").replace(/</g,"&lt;")}</div>
        <div class="msg-date">${formatDate(m.date)}</div>
        ${!m.read ? `<button class="btn-mark-read" data-id="${doc.id}">Marcar como leído ✓</button>` : ""}`;
      list.appendChild(card);
      if (!m.read) {
        card.querySelector(".btn-mark-read").onclick = async (e) => {
          const mid = e.target.dataset.id;
          await db.collection("messages").doc(mid).update({ read: true });
          card.classList.remove("unread");
          e.target.remove();
          loadUnreadCount();
          toast("Marcado como leído", "info");
        };
      }
    });
    loadUnreadCount();
  } catch (err) {
    list.innerHTML = `<p style="color:red;padding:20px">Error: ${err.message}</p>`;
  }
}

// ─── Send Message (students) ──────────────────────────────
$("fabMessage").onclick    = () => showOverlay("modalMessage");
$("btnCloseMessage").onclick = () => hideOverlay("modalMessage");
$("btnCancelMessage").onclick = () => hideOverlay("modalMessage");

// Restore sender name
const savedSender = localStorage.getItem("visitorName") || "";
if (savedSender) { const el = $("msgSender"); if (el) el.value = savedSender; }

$("messageForm").onsubmit = async (e) => {
  e.preventDefault();
  const sender  = $("msgSender").value.trim();
  const subject = $("msgSubject").value.trim();
  const body    = $("msgBody").value.trim();
  const anon    = $("msgAnon").checked;
  if (!sender || !subject || !body) {
    toast("Por favor completa todos los campos", "error"); return;
  }
  // Language filter on messages too
  if (containsBannedWord(body)) {
    toast("Tu mensaje contiene lenguaje inapropiado. Por favor sé respetuoso.", "error"); return;
  }
  localStorage.setItem("visitorName", sender);
  const btn = $("btnSubmitMessage");
  btn.disabled = true; btn.textContent = "Enviando…";
  try {
    await db.collection("messages").add({
      sender: anon ? "Anónimo" : sender,
      subject, body,
      anonymous: anon,
      read: false,
      date: firebase.firestore.FieldValue.serverTimestamp()
    });
    hideOverlay("modalMessage");
    $("messageForm").reset();
    toast("¡Mensaje enviado al administrador! 📬", "success");
    loadUnreadCount();
  } catch (err) {
    toast("Error al enviar: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "Enviar mensaje";
  }
};

// ─── Change Logo ──────────────────────────────────────────
$("btnChangeLogo").onclick  = () => showOverlay("modalLogo");
$("btnCloseLogo").onclick   = () => hideOverlay("modalLogo");
$("btnCancelLogo").onclick  = () => hideOverlay("modalLogo");

$("logoFile").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const preview = $("logoPreview");
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  preview.innerHTML = "";
  preview.appendChild(img);
};

$("btnSaveLogo").onclick = async () => {
  const file = $("logoFile").files[0];
  if (!file) { toast("Selecciona una imagen", "error"); return; }
  const btn = $("btnSaveLogo");
  btn.disabled = true; btn.textContent = "Guardando…";
  try {
    const data = await compressImage(file, 300, 0.9);
    await db.collection("config").doc("logo").set({ url: data });
    $("appLogo").src = data;
    $("appLogo").style.display = "block";
    const ml = document.querySelector(".modal-logo");
    if (ml) { ml.src = data; ml.style.display = "block"; }
    hideOverlay("modalLogo");
    toast("Logo actualizado ✅", "success");
  } catch (err) {
    toast("Error al guardar logo: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "Guardar logo";
  }
};

// ─── Change Admin Avatar ───────────────────────────────────
$("btnChangeAvatar").onclick = () => {
  // Show current avatar in preview
  if (adminAvatarUrl) {
    $("avatarPreviewImg").src = adminAvatarUrl;
    $("avatarPreviewImg").style.display = "block";
    $("avatarPreviewInitial").style.display = "none";
  }
  showOverlay("modalAvatar");
};
$("btnCloseAvatar").onclick  = () => hideOverlay("modalAvatar");
$("btnCancelAvatar").onclick = () => hideOverlay("modalAvatar");

$("avatarFile").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  $("avatarPreviewImg").src = url;
  $("avatarPreviewImg").style.display = "block";
  $("avatarPreviewInitial").style.display = "none";
};

$("btnSaveAvatar").onclick = async () => {
  const file = $("avatarFile").files[0];
  if (!file) { toast("Selecciona una imagen", "error"); return; }
  const btn = $("btnSaveAvatar");
  btn.disabled = true; btn.textContent = "Guardando…";
  try {
    // Compress to 200x200 for avatar
    const data = await compressImage(file, 200, 0.9);
    await db.collection("config").doc("adminAvatar").set({ url: data });
    adminAvatarUrl = data;
    // Update avatar in commenter bar if sheet is open
    const ca = $("commenterAvatar");
    if (ca) { ca.src = data; ca.style.display = "block"; }
    const ini = $("commenterAvatarInitial");
    if (ini) ini.style.display = "none";
    hideOverlay("modalAvatar");
    toast("Foto de perfil actualizada ✅", "success");
    // Reload feed to show new avatar on posts
    loadFeed();
  } catch (err) {
    toast("Error al guardar foto: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "Guardar foto";
  }
};

// ─── Init ─────────────────────────────────────────────────
refreshLogo();