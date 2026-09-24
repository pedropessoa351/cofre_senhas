import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { store } from "./store";
import { decryptJSON, deriveAuthSecret, deriveVaultKey, encryptJSON, generatePassword } from "./crypto";

type Secret = { title: string; username: string; password: string; url: string; notes: string };
type Item = Secret & { id: string };
const empty: Secret = { title: "", username: "", password: "", url: "", notes: "" };
const LOCK_MS = 5 * 60 * 1000;

export default function App() {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<(Secret & { id?: string }) | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const timer = useRef<number>();

  const lock = async () => { setKey(null); setItems([]); setEdit(null); await supabase?.auth.signOut(); };

  // Bloqueio automático após 5 minutos sem uso
  useEffect(() => {
    if (!key) return;
    const reset = () => { clearTimeout(timer.current); timer.current = window.setTimeout(lock, LOCK_MS); };
    const evts = ["click", "keydown", "mousemove"];
    evts.forEach((e) => window.addEventListener(e, reset)); reset();
    return () => { evts.forEach((e) => window.removeEventListener(e, reset)); clearTimeout(timer.current); };
  }, [key]);

  async function load(k: CryptoKey) {
    const data = await store.list();
    const out: Item[] = [];
    for (const r of data ?? []) out.push({ id: r.id, ...(await decryptJSON<Secret>(k, r.iv, r.ciphertext)) });
    setItems(out);
  }

  async function save() {
    if (!key || !edit || !edit.title) return;
    const payload = await encryptJSON(key, { title: edit.title, username: edit.username, password: edit.password, url: edit.url, notes: edit.notes });
    await store.save(payload, edit.id);
    setEdit(null); load(key);
  }

  async function remove(id: string) {
    if (!key || !confirm("Excluir este item? Não dá para desfazer.")) return;
    await store.remove(id); load(key);
  }

  const copy = async (t: string) => { await navigator.clipboard.writeText(t); setTimeout(() => navigator.clipboard.writeText(""), 20000); };

  if (!key) return <Login onDone={async (k, e) => { setEmail(e); setKey(k); await load(k); }} />;

  const list = items.filter((i) => (i.title + i.username + i.url).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="shell">
      <header>
        <h1>Cofre</h1>
        <input className="search" placeholder="Buscar no cofre" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => setEdit({ ...empty, password: generatePassword() })}>Novo item</button>
        <button className="ghost" onClick={lock}>Bloquear</button>
      </header>
      <p className="who">{email} · {items.length} {items.length === 1 ? "item" : "itens"}</p>
      {list.length === 0 && <p className="empty">Nenhum item ainda. Clique em “Novo item” para guardar sua primeira senha.</p>}
      <ul>
        {list.map((i) => (
          <li key={i.id}>
            <div className="main"><strong>{i.title}</strong><span>{i.username}</span></div>
            <code>{shown === i.id ? i.password : "••••••••••"}</code>
            <button className="ghost" onClick={() => setShown(shown === i.id ? null : i.id)}>{shown === i.id ? "Ocultar" : "Mostrar"}</button>
            <button className="ghost" onClick={() => copy(i.password)}>Copiar</button>
            <button className="ghost" onClick={() => setEdit(i)}>Editar</button>
            <button className="ghost danger" onClick={() => remove(i.id)}>Excluir</button>
          </li>
        ))}
      </ul>
      {edit && (
        <div className="modal" onClick={() => setEdit(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h2>{edit.id ? "Editar item" : "Novo item"}</h2>
            {(["title", "username", "url"] as const).map((f) => (
              <label key={f}>{{ title: "Título", username: "Usuário ou e-mail", url: "Endereço do site" }[f]}
                <input value={edit[f]} onChange={(e) => setEdit({ ...edit, [f]: e.target.value })} />
              </label>
            ))}
            <label>Senha
              <div className="row"><input value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
              <button className="ghost" onClick={() => setEdit({ ...edit, password: generatePassword() })}>Gerar</button></div>
            </label>
            <label>Notas<textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
            <div className="row end"><button className="ghost" onClick={() => setEdit(null)}>Cancelar</button><button onClick={save}>Salvar item</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Login({ onDone }: { onDone: (k: CryptoKey, email: string) => void }) {
  const local = !supabase;
  const hasVault = local && !!localStorage.getItem("cofre.check");
  const [mode, setMode] = useState<"in" | "up">(local && !hasVault ? "up" : "in");
  const [email, setEmail] = useState("");
  const [master, setMaster] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const LOCAL = "Cofre neste dispositivo";

  async function go() {
    setErr(""); setBusy(true);
    try {
      if (mode === "up" && master.length < 12) throw new Error("A senha mestra precisa ter pelo menos 12 caracteres.");
      if (local) {
        if (mode === "up") {
          const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
          const k = await deriveVaultKey(master, "local:" + salt);
          localStorage.setItem("cofre.salt", salt);
          localStorage.setItem("cofre.check", JSON.stringify(await encryptJSON(k, { ok: true })));
          return onDone(k, LOCAL);
        }
        const k = await deriveVaultKey(master, "local:" + localStorage.getItem("cofre.salt"));
        const c = JSON.parse(localStorage.getItem("cofre.check")!);
        try { await decryptJSON(k, c.iv, c.ciphertext); } catch { throw new Error("Senha mestra incorreta."); }
        return onDone(k, LOCAL);
      }
      const secret = await deriveAuthSecret(master, email);
      const { error } = mode === "up"
        ? await supabase!.auth.signUp({ email, password: secret })
        : await supabase!.auth.signInWithPassword({ email, password: secret });
      if (error) throw new Error(error.message);
      onDone(await deriveVaultKey(master, email), email);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="login">
      <h1>Cofre</h1>
      <p>Suas senhas são cifradas no seu navegador. Ninguém consegue lê-las sem a senha mestra.</p>
      {local && <p className="note">Modo local: os dados ficam só neste navegador. Limpar os dados do navegador apaga o cofre.</p>}
      {!local && <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
      <label>Senha mestra<input type="password" value={master} onChange={(e) => setMaster(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} /></label>
      {mode === "up" && <p className="warn">Se você esquecer a senha mestra, não há como recuperar o cofre. Anote-a em um lugar seguro.</p>}
      {err && <p className="err">{err}</p>}
      <button disabled={busy || !master || (!local && !email)} onClick={go}>{busy ? "Aguarde…" : mode === "in" ? "Abrir cofre" : "Criar cofre"}</button>
      {!local && <button className="ghost" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Criar uma conta" : "Já tenho conta"}</button>}
    </div>
  );
}
