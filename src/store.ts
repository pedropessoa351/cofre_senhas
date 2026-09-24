import { supabase } from "./supabase";
type Payload = { iv: string; ciphertext: string };
export type Row = Payload & { id: string };
const LS = "cofre.items";
const read = (): Row[] => JSON.parse(localStorage.getItem(LS) || "[]");
const write = (r: Row[]) => localStorage.setItem(LS, JSON.stringify(r));

export const store = {
  async list(): Promise<Row[]> {
    if (supabase) return (await supabase.from("vault_items").select("*").order("created_at")).data ?? [];
    return read();
  },
  async save(p: Payload, id?: string) {
    if (supabase) {
      if (id) await supabase.from("vault_items").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
      else await supabase.from("vault_items").insert(p);
      return;
    }
    const rows = read();
    if (id) write(rows.map((r) => (r.id === id ? { id, ...p } : r)));
    else write([...rows, { id: crypto.randomUUID(), ...p }]);
  },
  async remove(id: string) {
    if (supabase) await supabase.from("vault_items").delete().eq("id", id);
    else write(read().filter((r) => r.id !== id));
  },
};
