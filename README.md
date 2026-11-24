# Linkbee

Alternativa simples ao Linktree. HTML + JS + CSS puro, Supabase (auth + banco), Cloudinary (imagens), hospedagem estatica no Render.

## Paginas
- `index.html` — apresentacao + login/cadastro
- `dashboard.html` — editar perfil, redes, links (com preview ao vivo)
- `conta.html` — logout, trocar senha, excluir Linkbee, excluir conta
- `u.html` — pagina publica (`/u/usuario`)

## Configuracao
1. **Supabase**: crie um projeto, abra o SQL Editor e rode `supabase/schema.sql`.
   Em *Authentication > Providers > Email*, desative "Confirm email" se quiser login imediato apos o cadastro.
   Em *Authentication > URL Configuration*, adicione a URL do seu site (Render) em Site URL / Redirect URLs.
2. **Cloudinary**: em *Settings > Upload > Upload presets*, crie um preset **Unsigned** (ex.: `linkbee_unsigned`).
3. Edite `js/config.js` com URL e anon key do Supabase (Project Settings > API) e o cloud name + preset.
4. **Teste local**: `npx serve .` (as rotas usam caminhos absolutos; localmente a pagina publica abre em `/u.html?u=usuario`).
5. **Deploy no Render**: suba para o GitHub, crie um *Static Site* apontando para o repo (o `render.yaml` ja configura o rewrite de `/u/*`). Publish directory: `.`

A anon key e publica por design; a seguranca vem das politicas RLS do `schema.sql`.
