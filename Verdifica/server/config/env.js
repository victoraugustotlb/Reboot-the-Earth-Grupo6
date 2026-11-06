// Valida a configuração antes de abrir o banco e iniciar o servidor.
export function loadConfig(env = process.env) {
  const authEnabled = env.AUTH_ENABLED === 'true';
  const required = authEnabled ? ['API_WRITE_TOKEN', 'PUBLIC_BASE_URL'] : ['PUBLIC_BASE_URL'];
  for (const key of required) if (!env[key]) throw new Error(`Configure ${key} no arquivo .env.`);
  if (authEnabled && env.API_WRITE_TOKEN.length < 24)
    throw new Error('API_WRITE_TOKEN deve ter pelo menos 24 caracteres.');
  const parseOrigin = (value, key) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${key} deve conter uma origem HTTP ou HTTPS válida.`);
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error(`${key} deve conter apenas protocolo, domínio e porta, sem caminho.`);
    return url.origin;
  };
  const publicBaseUrl = parseOrigin(env.PUBLIC_BASE_URL, 'PUBLIC_BASE_URL');
  const corsOrigins = [
    ...new Set(
      (env.CORS_ORIGINS ?? publicBaseUrl)
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => parseOrigin(origin, 'CORS_ORIGINS')),
    ),
  ];
  const port = Number(env.PORT || 3001);
  const host = env.HOST || '127.0.0.1';
  // O modo sem autenticação é destinado somente ao teste neste computador.
  if (!authEnabled && !['127.0.0.1', '::1', 'localhost'].includes(host))
    throw new Error('Sem autenticação, HOST deve usar um endereço de loopback local.');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  return {
    port,
    host,
    authEnabled,
    writeToken: env.API_WRITE_TOKEN,
    publicBaseUrl,
    corsOrigins,
  };
}
