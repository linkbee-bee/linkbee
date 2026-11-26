// Pagina inicial. A biblioteca do Supabase (~48 KB) so e baixada quando a pessoa
// abre o login/cadastro ou ja tem uma sessao salva, para a pagina abrir mais rapido.
const SB_SRC = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/dist/umd/supabase.js";
let sbPromise = null;
function getSb() {
  sbPromise ||= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SB_SRC;
    el.onload = () => resolve(window.supabase.createClient(LINKBEE.SUPABASE_URL, LINKBEE.SUPABASE_ANON_KEY));
    el.onerror = () => { sbPromise = null; el.remove(); reject(new I18N.KeyErr("err_generic")); };
    document.head.appendChild(el);
  });
  return sbPromise;
}

document.getElementById("yr").textContent = new Date().getFullYear();

const dlg = document.getElementById("authDlg");
let mode = "login";
function setMode(m) {
  mode = m;
  tabLogin.classList.toggle("on", m === "login");
  tabSignup.classList.toggle("on", m === "signup");
  userWrap.classList.toggle("hidden", m !== "signup");
  pass2Wrap.classList.toggle("hidden", m !== "signup");
  fPass2.value = "";
  authBtn.dataset.i18n = m === "login" ? "btn_login" : "btn_signup";
  authBtn.textContent = I18N.t(authBtn.dataset.i18n);
  fPass.autocomplete = m === "login" ? "current-password" : "new-password";
  forgot.parentElement.classList.toggle("hidden", m !== "login");
  authMsg.classList.add("hidden");
}
function openAuth(m) { showReset(false); setMode(m); if (!dlg.open) dlg.showModal(); getSb().catch(() => {}); }
function showErr(err) {
  if (err.key) I18N.msg(authMsg, err.key);
  else if (/Invalid login/i.test(err.message || "")) I18N.msg(authMsg, "err_invalid_login");
  else I18N.raw(authMsg, err.message || I18N.t("err_generic"));
}
document.querySelectorAll("[data-auth]").forEach((b) => b.addEventListener("click", () => openAuth(b.dataset.auth)));
tabLogin.onclick = () => setMode("login");
tabSignup.onclick = () => setMode("signup");
closeDlg.onclick = () => dlg.close();
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

claim.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = claimInput.value.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  openAuth("signup"); fUser.value = v;
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authBtn.disabled = true; authMsg.classList.add("hidden");
  try {
    if (mode === "login") {
      const sb = await getSb();
      const { error } = await sb.auth.signInWithPassword({ email: fEmail.value.trim(), password: fPass.value });
      if (error) throw error;
      location.href = "/dashboard.html";
    } else {
      const username = fUser.value.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,30}$/.test(username)) throw new I18N.KeyErr("err_username");
      if (fPass.value !== fPass2.value) throw new I18N.KeyErr("err_pass_match");
      const sb = await getSb();
      const { data: taken } = await sb.from("pages").select("id").eq("slug", username).maybeSingle();
      if (taken) throw new I18N.KeyErr("err_taken");
      const { data, error } = await sb.auth.signUp({ email: fEmail.value.trim(), password: fPass.value, options: { data: { username } } });
      if (error) throw error;
      if (data.session) location.href = "/dashboard.html";
      else I18N.msg(authMsg, "signup_confirm", true);
    }
  } catch (err) {
    showErr(err);
  } finally { authBtn.disabled = false; }
});

googleBtn.addEventListener("click", async () => {
  try {
    const sb = await getSb();
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/dashboard.html" } });
    if (error) throw error;
  } catch (err) { showErr(err); }
});

// Recuperacao de senha por codigo (Edge Function "password-reset")
let rStep = 1;
function rShowErr(err) { if (err.key) I18N.msg(rMsg, err.key); else I18N.raw(rMsg, err.message || I18N.t("err_generic")); }
function showReset(on) {
  resetForm.classList.toggle("hidden", !on);
  authForm.classList.toggle("hidden", on);
  document.querySelector(".tabs").classList.toggle("hidden", on);
  googleBtn.classList.toggle("hidden", on);
  orTxt.classList.toggle("hidden", on);
  if (on) {
    rStep = 1; rEmail.value = fEmail.value;
    rStep1.classList.remove("hidden"); rStep2.classList.add("hidden");
    rBtn.dataset.i18n = "btn_send_code"; rBtn.textContent = I18N.t("btn_send_code"); rMsg.classList.add("hidden");
    rResend.classList.add("hidden"); rSep.classList.add("hidden");
    rCode.value = rPass.value = rPass2.value = "";
  }
}
async function resetCall(body) {
  const r = await fetch(`${LINKBEE.SUPABASE_URL}/functions/v1/password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: LINKBEE.SUPABASE_ANON_KEY },
    body: JSON.stringify({ ...body, lang: I18N.idioma() }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new I18N.KeyErr(I18N.has("fn_" + j.error) ? "fn_" + j.error : "fn_internal");
  return j;
}
async function sendCode() {
  await resetCall({ action: "request", email: rEmail.value.trim() });
  rStep = 2;
  rStep1.classList.add("hidden"); rStep2.classList.remove("hidden");
  rBtn.dataset.i18n = "btn_reset"; rBtn.textContent = I18N.t("btn_reset");
  rResend.classList.remove("hidden"); rSep.classList.remove("hidden");
  I18N.msg(rMsg, "reset_sent", true);
}
forgot.addEventListener("click", (e) => { e.preventDefault(); showReset(true); });
rBack.addEventListener("click", (e) => { e.preventDefault(); showReset(false); setMode("login"); });
rResend.addEventListener("click", async (e) => {
  e.preventDefault();
  try { await sendCode(); I18N.msg(rMsg, "reset_resent", true); } catch (err) { rShowErr(err); }
});
resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  rBtn.disabled = true; rMsg.classList.add("hidden");
  try {
    if (rStep === 1) { await sendCode(); return; }
    if (!/^\d{6}$/.test(rCode.value.trim())) throw new I18N.KeyErr("err_code6");
    if (rPass.value.length < 6) throw new I18N.KeyErr("err_pass_short");
    if (rPass.value !== rPass2.value) throw new I18N.KeyErr("err_pass_match");
    await resetCall({ action: "confirm", email: rEmail.value.trim(), code: rCode.value.trim(), password: rPass.value });
    const email = rEmail.value;
    showReset(false); setMode("login"); fEmail.value = email; fPass.value = "";
    I18N.msg(authMsg, "pass_changed", true);
  } catch (err) { rShowErr(err); }
  finally { rBtn.disabled = false; }
});

// So consulta a sessao se houver uma salva (ou um retorno de login na URL)
const sessionKey = `sb-${new URL(LINKBEE.SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
if (localStorage.getItem(sessionKey) || /access_token=|[?&]code=/.test(location.href)) {
  getSb().then((sb) => sb.auth.getSession()).then(({ data }) => {
    if (data.session) {
      navActions.innerHTML = '<a class="btn brand sm" href="/dashboard.html" data-i18n="nav_panel"></a>';
      I18N.aplicar(navActions);
    }
  }).catch(() => {});
}
