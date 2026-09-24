# Cofre — gerenciador de senhas (React + Supabase)

Inspirado no modelo *zero-knowledge* do Keeper: a senha mestra nunca sai do navegador e o servidor só guarda texto cifrado.

## Como funciona a segurança
- **Senha mestra** → PBKDF2-SHA256 (600 mil iterações) gera duas coisas separadas: a senha de login do Supabase Auth e a chave AES-256.
- Cada item (título, usuário, senha, URL, notas) é cifrado com **AES-GCM** e IV aleatório antes de ir ao banco.
- **RLS** no Supabase garante que cada usuário só acesse as próprias linhas.
- Bloqueio automático após 5 min sem atividade; a área de transferência é limpa após 20 s.
- Sem a senha mestra não há recuperação. Isso é proposital.

## Configuração
1. Crie um projeto no [Supabase](https://supabase.com) e rode `supabase/schema.sql` no SQL Editor.
2. Em Authentication → Providers → Email, deixe e-mail/senha ativo (desative "Confirm email" para testes locais).
3. `cp .env.example .env` e preencha URL e chave *anon*.
4. `npm install && npm run dev`

## Publicar no Git
```bash
git init && git add . && git commit -m "Cofre inicial"
git remote add origin <url-do-repositorio> && git push -u origin main
```
Nunca suba o arquivo `.env`. Para deploy (Vercel/Netlify), configure as duas variáveis `VITE_*` no painel.

## Próximos passos sugeridos
Pastas e compartilhamento, 2FA/TOTP, importação de CSV, extensão de navegador, alerta de senhas vazadas ou fracas.
