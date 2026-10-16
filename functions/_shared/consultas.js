export async function buscarSessoesDoUsuario(env, nome) {
  return env.DB.prepare("SELECT * FROM sessions WHERE display_name = ?").bind(nome).all();
}