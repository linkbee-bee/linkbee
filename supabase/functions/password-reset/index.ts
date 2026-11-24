// Edge Function: recuperacao de senha por codigo de 6 digitos enviado pelo Gmail.
// Secrets necessarios: GMAIL_USER, GMAIL_APP_PASSWORD
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ja existem automaticamente.)
// Deploy SEM verificacao de JWT (a funcao e chamada por quem esta deslogado).
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const EXPIRES_MIN = 10;
const MAX_ATTEMPTS = 5;
const INVALID = "invalid_code"; // codigos de erro: o site traduz para PT/ES/EN

type Lang = "pt" | "es" | "en";
const MAIL: Record<Lang, { subject: string; h: string; p: string; note: string; text: string }> = {
  pt: {
    subject: "Seu código de recuperação do Linkbee",
    h: "Recuperação de senha",
    p: "Use o código abaixo para criar uma nova senha no Linkbee:",
    note: `O código vale por ${EXPIRES_MIN} minutos. Se você não pediu isso, ignore este e-mail.`,
    text: "Seu código de recuperação é {code}. Ele vale por " + EXPIRES_MIN + " minutos. Se você não pediu, ignore este e-mail.",
  },
  es: {
    subject: "Tu código de recuperación de Linkbee",
    h: "Recuperación de contraseña",
    p: "Usa el siguiente código para crear una nueva contraseña en Linkbee:",
    note: `El código vale por ${EXPIRES_MIN} minutos. Si no lo pediste, ignora este correo.`,
    text: "Tu código de recuperación es {code}. Vale por " + EXPIRES_MIN + " minutos. Si no lo pediste, ignora este correo.",
  },
  en: {
    subject: "Your Linkbee recovery code",
    h: "Password recovery",
    p: "Use the code below to create a new password on Linkbee:",
    note: `The code is valid for ${EXPIRES_MIN} minutes. If you didn't request this, ignore this email.`,
    text: "Your recovery code is {code}. It is valid for " + EXPIRES_MIN + " minutes. If you didn't request it, ignore this email.",
  },
};

async function sendMail(to: string, code: string, lang: Lang) {
  const user = Deno.env.get("GMAIL_USER")!;
  const m = MAIL[lang];
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: Deno.env.get("GMAIL_APP_PASSWORD")! },
  });
  await transporter.sendMail({
    from: `Linkbee <${user}>`,
    to,
    subject: m.subject,
    text: m.text.replace("{code}", code),
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #ece5d3;border-radius:16px">
      <h2 style="margin:0 0 8px;color:#120c01">${m.h}</h2>
      <p style="color:#6f6652">${m.p}</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:800;background:#fdc603;color:#120c01;text-align:center;border-radius:12px;padding:14px;margin:18px 0">${code}</p>
      <p style="color:#6f6652;font-size:13px">${m.note}</p></div>`,
  });
}

async function requestCode(email: string, lang: Lang) {
  const { data: rows, error: rpcError } = await admin.rpc("user_for_reset", { p_email: email });
  if (rpcError) { console.error("[reset] rpc user_for_reset falhou (rodou a migration?):", rpcError.message); return; }
  const u = rows?.[0];
  // Motivos abaixo aparecem so nos Logs; o usuario recebe sempre a mesma resposta.
  if (!u) { console.log("[reset] nenhuma conta com esse e-mail"); return; }
  if (!u.has_password) { console.log("[reset] conta so-Google, sem senha: nao envia"); return; }

  const now = Date.now();
  const recent = async (ms: number) => {
    const { count } = await admin.from("password_resets").select("id", { count: "exact", head: true })
      .eq("user_id", u.id).gte("created_at", new Date(now - ms).toISOString());
    return count ?? 0;
  };
  if ((await recent(60_000)) > 0) return; // 1 pedido por minuto
  if ((await recent(3_600_000)) >= 5) return; // 5 por hora

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  await admin.from("password_resets").update({ used: true }).eq("user_id", u.id).eq("used", false);
  const { error } = await admin.from("password_resets").insert({
    user_id: u.id, email, code_hash: await sha256(`${email}:${code}`),
    expires_at: new Date(now + EXPIRES_MIN * 60_000).toISOString(),
  });
  if (error) { console.error("insert reset", error); return; }
  try { await sendMail(email, code, lang); console.log("[reset] e-mail enviado"); } catch (e) { console.error("[reset] sendMail falhou:", e); }
}

async function confirmCode(email: string, code: string, password: string) {
  if (password.length < 6) return json({ error: "short_password" }, 400);
  const { data: rows } = await admin.rpc("user_for_reset", { p_email: email });
  const u = rows?.[0];
  if (!u) return json({ error: INVALID }, 400);

  const { data: r } = await admin.from("password_resets").select("*")
    .eq("user_id", u.id).eq("used", false).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!r || r.attempts >= MAX_ATTEMPTS) return json({ error: INVALID }, 400);

  await admin.from("password_resets").update({ attempts: r.attempts + 1 }).eq("id", r.id);
  if (r.code_hash !== (await sha256(`${email}:${code}`))) return json({ error: INVALID }, 400);

  await admin.from("password_resets").update({ used: true }).eq("id", r.id);
  const { error } = await admin.auth.admin.updateUserById(u.id, { password });
  if (error) { console.error("[reset] updateUser:", error.message); return json({ error: "internal" }, 400); }
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email" }, 400);
    const lang: Lang = ["pt", "es", "en"].includes(body.lang) ? body.lang : "pt";
    if (body.action === "request") {
      await requestCode(email, lang);
      return json({ ok: true });
    }
    if (body.action === "confirm") {
      return await confirmCode(email, String(body.code || "").trim(), String(body.password || ""));
    }
    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "internal" }, 500);
  }
});
