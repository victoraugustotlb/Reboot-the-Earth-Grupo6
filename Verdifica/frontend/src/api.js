// A senha é mantida somente em memória; não entra no build nem no armazenamento do navegador.
let token = '';
export const setApiToken = (value) => {
  token = value;
};
export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new Error('Não foi possível conectar à API local. Inicie o servidor e tente novamente.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Não foi possível concluir a solicitação.');
    error.status = response.status;
    throw error;
  }
  return result;
}
