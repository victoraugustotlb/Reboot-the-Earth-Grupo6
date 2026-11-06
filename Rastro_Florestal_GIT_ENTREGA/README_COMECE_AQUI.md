# Rastro Florestal - entrega para integrar no Git

## O que subir no repositorio
Copie **somente `backend/`** para a raiz do repositorio React do seu amigo, mantendo o frontend existente. O diretorio `pitch_apenas_nao_integrar/` contem PDFs para slides, **nao e codigo da API**. `demo_respostas/` contem exemplos de contrato e **nao e medicao ao vivo**.

## Execucao
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# autentique o Google Earth Engine no computador que executa o backend
export EE_PROJECT=233354775100
python -m uvicorn api.main:app --reload
```
Abra http://127.0.0.1:8000/docs. A credencial Earth Engine NAO esta no Git e nao deve ser commitada. O projeto EE_PROJECT pode variar conforme a conta.

## Testes
```bash
cd backend
python -m unittest discover -s testes -v
```
Testes usam mocks: **nao validam acesso real ao Earth Engine**. O usuario testou imagens e PDF reais em seu Mac anteriormente, mas esta entrega nao foi testada no computador dele apos integrar.

## Endpoints
- GET / e /saude: saude
- GET /permissoes/demo: permissao ficticia
- POST /relatorio/gerar: JSON + decisao_token
- POST /relatorio/pdf: PDF binario, usando mesmo request
- POST /imagens/satelite: imagens temporarias
- POST /sentinel/analisar: analise geoespacial
- GET /amazonia1/resumo, /amazonia1/inventario, /relatorio/demo: dados experimentais/demo

## Decisao de token
- `decisao_token.pode_emitir === true` E `tipo_token === 'rastro_experimental'` -> apenas token DEMONSTRATIVO
- false, ausencia do campo, erro de rede, 4xx/5xx -> nao emitir
- Status favoravel do motor: `sem_divergencia_detectada_nesta_analise` (ja tratado em api/token.py)
- Permissao local e ficticia, nenhum token e comprovacao de legalidade.

## Demo Sao Paulo vs area analisada
A foto e o GPS do celular sao REAIS e pertencem a **tentativa**. O cenario geoespacial de demonstracao e outra area: **nao reetiquetar GPS de Sao Paulo como GPS da Amazonia**. Se usar resultados preparados, marcar `modo_demo=true` na interface e separar `localizacao_captura` de `localizacao_area_demo`. A funcao de token do backend exige origem `device` compativel com a permissao: para o pitch em Sao Paulo, use **somente a resposta favoravel simulada** e nao finja que o backend validou o GPS real.

## Rede e CORS
`localhost` do celular ou do notebook do amigo nao e o Mac do desenvolvedor. Para acessar de outro dispositivo, configurar IP/HTTPS e CORS apropriado. Nunca publicar credenciais EE.

## Limites
O PDF recalcula a analise em outra chamada; pode demorar ou divergir. URLs de thumbnails temporarias. Sem autenticacao, persistencia de relatorios ou token assinado. Testar o fluxo final em dois aparelhos antes do pitch.
