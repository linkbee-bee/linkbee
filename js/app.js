// Helpers compartilhados + renderizador da pagina publica (usado tambem no preview).
const sb = window.supabase.createClient(LINKBEE.SUPABASE_URL, LINKBEE.SUPABASE_ANON_KEY);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function safeUrl(u) {
  u = String(u || "").trim();
  if (!u) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return "mailto:" + u;
  return "https://" + u.replace(/^\/+/, "");
}

function toast(msg, type = "ok") {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = "show " + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ""), 3000);
}

async function uploadImage(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Imagem muito grande (max. 5MB).");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", LINKBEE.CLOUDINARY_UPLOAD_PRESET);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${LINKBEE.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Falha no upload da imagem.");
  return j.secure_url;
}

const ICONS = {
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l1.6-5A8.5 8.5 0 1 1 8 19.4L3 21z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-.8.7c-.8-.4-1.6-1.2-2-2l.7-.8-1-2L9 9.5z" fill="currentColor"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2 4 4.5 4.2"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>',
  website: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',
};
const SOCIAL_FIELDS = [
  ["instagram", "Instagram", "https://instagram.com/seuuser"],
  ["whatsapp", "WhatsApp", "5511999999999 (so numeros)"],
  ["tiktok", "TikTok", "https://tiktok.com/@seuuser"],
  ["youtube", "YouTube", "https://youtube.com/@seucanal"],
  ["website", "Site", "https://seusite.com"],
  ["email", "E-mail", "voce@email.com"],
];

function socialHref(key, val) {
  val = String(val || "").trim();
  if (!val) return "";
  if (key === "whatsapp") {
    const digits = val.replace(/\D/g, "");
    return digits ? "https://wa.me/" + digits : "";
  }
  return safeUrl(val);
}

function renderPage(el, page, links) {
  const name = page.title || page.slug || "";
  const initial = esc((name || "?").trim().charAt(0).toUpperCase());
  const socials = SOCIAL_FIELDS.map(([k]) => {
    const h = socialHref(k, page.socials?.[k]);
    return h ? `<a class="lb-social" href="${esc(h)}" target="_blank" rel="noopener noreferrer" aria-label="${k}">${ICONS[k]}</a>` : "";
  }).join("");
  const items = (links || []).filter((l) => l.active !== false).map((l) => {
    const icon = l.icon_url
      ? `<img class="lb-ico" src="${esc(l.icon_url)}" alt="">`
      : `<span class="lb-ico lb-ico-ph">${esc((l.title || "?").charAt(0).toUpperCase())}</span>`;
    return `<a class="lb-link" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">
      ${icon}<span class="lb-text"><b>${esc(l.title)}</b>${l.subtitle ? `<small>${esc(l.subtitle)}</small>` : ""}</span></a>`;
  }).join("");
  el.innerHTML = `
    <div class="lb-avatar">${page.avatar_url ? `<img src="${esc(page.avatar_url)}" alt="">` : `<span>${initial}</span>`}</div>
    <h1 class="lb-title">${esc(name)}</h1>
    ${page.bio ? `<p class="lb-bio">${esc(page.bio)}</p>` : ""}
    ${socials ? `<div class="lb-socials">${socials}</div>` : ""}
    <div class="lb-links">${items}</div>
    <a class="lb-foot" href="/">Crie o seu <b>Linkbee</b> gratis</a>`;
}

function publicUrl(slug) {
  return `${location.origin}/u/${slug}`;
}
