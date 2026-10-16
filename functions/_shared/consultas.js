export async function buscarSessoesDoUsuario(env, nome) {
  return env.DB.prepare("SELECT * FROM sessions WHERE display_name = ?").bind(nome).all();
}

const COLUNAS_ORDENAVEIS = { criacao: "created_at", expiracao: "expires_at" };

export async function listarSessoes(env, ordem) {
  const coluna = COLUNAS_ORDENAVEIS[ordem] ?? "created_at";
  return env.DB.prepare(`SELECT id_hash, display_name FROM sessions ORDER BY ${coluna} DESC`).all();
}