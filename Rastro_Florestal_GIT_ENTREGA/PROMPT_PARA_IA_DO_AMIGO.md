# PROMPT PARA O CHATGPT DO DESENVOLVEDOR REACT

Voce esta integrando o frontend React do projeto **Rastro Florestal** ao backend FastAPI que recebi no diretorio `backend/`. Leia `README_COMECE_AQUI.md`, `backend/api/main.py`, `backend/api/token.py` e os modelos Pydantic antes de alterar o frontend. Preserve o fluxo atual de registros, produtos e tentativas, IndexedDB e fotos. **Foto e GPS pertencem a tentativa, nao ao produto.** A foto JPEG capturada do video nao contem GPS em EXIF; coordenadas e precisao estao em objeto separado. Nunca enviar `blob:` URL como imagem de servidor.

Objetivo: apresentar no hackathon um **modo de demonstracao explicito** e, quando possivel, um modo de API real. Nao tentar fazer GPS real de Sao Paulo passar como propriedade amazonica. Mostrar separadamente localizacao de captura (real) e area de analise (demo). Nao alegar certificacao de legalidade.

Tarefas:
1. Criar um cliente de API com URL configuravel via `VITE_API_URL`, com estados loading, sucesso, erro e timeout; nao assumir que localhost no celular acessa o backend.
2. Integrar `GET /saude`, `GET /permissoes/demo`, `POST /relatorio/gerar` e `POST /relatorio/pdf`. No PDF, usar `response.blob()` e baixar como arquivo, nao JSON. O payload de referencia esta em `demo_respostas/request_alerta.json`.
3. Exibir resultado de `decisao_token`. Emitir **somente token experimental** quando `pode_emitir === true` e `tipo_token === 'rastro_experimental'`; em erro, inconclusivo ou false, nao emitir. Deixar claro que token criado apenas no cliente e falsificavel, sem validade oficial.
4. Implementar alternancia visivel de pitch entre `Cenario com alerta` e `Cenario favoravel SIMULADO`, usando exemplos em `demo_respostas/`. Nao apresentar a resposta favoravel simulada como consulta real de satelite. Mostrar selo 'DEMONSTRACAO'.
5. Usar PDFs de `pitch_apenas_nao_integrar/` apenas como anexos estaticos para slides ou demonstracao. Nao misturar os PDFs de pitch com relatorios de uma tentativa real.
6. Manter IDs `registro_id`, `produto_id`, `tentativa_id` associados corretamente. Preservar GPS com `accuracy`, `timestamp`, `source`; nao inventar autenticidade de EXIF.
7. Nao sobrescrever arquivos existentes sem verificar; integrar incrementalmente e testar o app.

Contrato: `POST /relatorio/gerar` retorna `decisao_token` com `pode_emitir`, `status`, `motivo`, `tipo_token`. O backend tem regra demonstrativa em `backend/api/token.py`. Nao substituir por comparacao manual de hectares no frontend. A fonte de permissao e ficticia. A API EE necessita autenticacao no host do backend. Se houver duvidas, abra `/openapi.json` com servidor rodando.

Entregue alteracoes de codigo concretas e um roteiro de pitch de 2 minutos com os dois cenarios, sem falsas alegacoes.
