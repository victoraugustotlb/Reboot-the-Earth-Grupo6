# Verdefica — frontend integrado

Frontend React fornecido no ZIP, integrado à API Express e ao SQLite deste projeto. O visual, a câmera, o GPS, os históricos por etapa e o modo de demonstração foram preservados. A persistência IndexedDB foi substituída por chamadas HTTP: dados e bytes das fotos ficam em `../data/reboot.sqlite`.

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra http://127.0.0.1:5173. O sistema inicia diretamente em **Meus registros**, sem login ou senha. A API usa `AUTH_ENABLED=false` por padrão neste MVP local.

`npm run build` na raiz gera `frontend/dist`. Com a API iniciada, `npm run preview:web` serve o build e mantém o proxy de `/api`.

O novo módulo `/api/records` atende a registros com múltiplos produtos e até três tentativas por etapa. O módulo `/api/products` continua disponível e seus links de rastreio também são reconhecidos pelo frontend. Os detalhes do contrato e a estrutura estão no README da raiz.

A versão atual inclui tipo de produto, solicitação de token após cinco dias, antecipação auditável para pitch e etiquetas QR em PNG para download/impressão. A API controla o prazo e persiste os ciclos no SQLite. Novas fotos ou mudança de tipo invalidam o ciclo anterior; renomear preserva o snapshot emitido. A etiqueta contém dados do produtor e coordenadas; a consulta pública por link mantém esses campos protegidos. Trata-se de demonstração, sem certificação externa. O conteúdo comum das etiquetas está em `../shared/labels/labelPayload.js`.

Os arquivos de documentação e scripts HTTPS que vieram no ZIP são referências do projeto original, não são executados no fluxo integrado. Os comandos de acesso por rede do projeto original foram removidos dos scripts npm; a execução padrão aceita apenas acesso local. A câmera e o GPS exigem permissão do navegador e um contexto seguro. As coordenadas simuladas continuam identificadas como demonstração.

`src/store.js` faz a adaptação para multipart; `src/api.js` centraliza a comunicação; `src/domain/record.js` mantém as regras da interface; `src/pages/Trace.jsx` implementa a consulta pública. O rascunho fica na memória até salvar. Dados antigos em IndexedDB não são migrados automaticamente.

## Triagem ambiental

A tela do produto inclui análise GeoAI, dados de referência e download de relatório PDF. O serviço Python é preparado por npm run setup:geoai e iniciado junto da API e do frontend por npm run dev. Sentinel-2/Dynamic World real exige EE_PROJECT e autenticação; o modo de referência funciona sem credenciais e não aprova token. A verificação de fotos confere formato e resolução, sem IA visual. Configuração e limitações estão no README da raiz.
