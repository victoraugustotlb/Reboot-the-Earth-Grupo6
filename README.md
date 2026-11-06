# 🌳 Rastro Florestal

### Infraestrutura Pública Digital para Rastreabilidade de Produtos Florestais

**Projeto desenvolvido para hackathon | MVP experimental | Código aberto**

## 1. Visão geral

O **Rastro Florestal** é uma proposta de infraestrutura pública digital, aberta e escalável, destinada a apoiar pequenos produtores na rastreabilidade de produtos provenientes de áreas florestais.

A solução busca facilitar o registro de produtos, a organização de evidências de origem e a análise preliminar de possíveis alterações ambientais nas áreas associadas à produção.

O objetivo é conectar pequenos produtores, compradores, organizações e órgãos públicos por meio de informações estruturadas, verificáveis e interoperáveis.

O projeto foi concebido inicialmente para o contexto brasileiro, com possibilidade de adaptação para outros países e biomas da América do Sul.

**Importante:** o MVP não emite certificações oficiais de legalidade ambiental. Seus resultados são experimentais e devem ser interpretados como indicadores de risco e evidências para conferência.

---

## 2. Problema

Pequenos produtores enfrentam dificuldades para demonstrar a origem de seus produtos florestais e organizar documentos e evidências exigidos por compradores e instituições.

Entre os principais desafios estão:

- Processos de rastreabilidade fragmentados.
- Dificuldade de acesso a ferramentas de monitoramento ambiental.
- Falta de integração entre informações de produção, localização e documentação.
- Custos e barreiras tecnológicas para pequenos produtores.
- Dificuldade de compartilhar evidências de maneira padronizada.

O Rastro Florestal propõe reduzir essas barreiras com uma solução digital simples e acessível.

## 3. Solução proposta

O aplicativo permite registrar produtos e tentativas de comprovação de origem, associando fotografias, localização geográfica e informações do produtor.

O backend GeoAI utiliza dados de sensoriamento remoto para identificar possíveis alterações na cobertura vegetal e comparar os resultados com uma área declarada.

O sistema organiza essas informações em um relatório ambiental e devolve uma decisão experimental para orientar a emissão de um token demonstrativo de rastreabilidade.

### Fluxo principal

```text
PRODUTOR
   |
   v
Registro do produto
   |
   v
Captura de foto + GPS
   |
   v
Consulta ao GeoAI
   |
   v
Analise ambiental por satelite
   |
   v
Comparacao com area declarada
   |
   v
Relatorio ambiental em PDF
   |
   +--> Sem alertas: token experimental
   |
   +--> Divergencia: revisao necessaria
   |
   +--> Dados insuficientes: nao emitir
```

A decisão experimental não equivale à validação jurídica da atividade ou do produto.

---

## 4. Arquitetura técnica

O projeto é dividido em dois componentes principais.

### 4.1 Frontend

**Tecnologia:** React.

Responsável por:

- Interface para pequenos produtores.
- Registro de produtos.
- Captura de fotografias.
- Captura de localização GPS.
- Armazenamento local dos registros.
- Consulta ao backend GeoAI.
- Exibição dos resultados ambientais.
- Geração de tokens ou QR Codes demonstrativos.
- Download de relatórios PDF.

O frontend é desenvolvido separadamente pela equipe e deve ser integrado ao backend.

### 4.2 Backend GeoAI

**Tecnologias principais:**

- Python.
- FastAPI.
- Google Earth Engine.
- Sentinel-2 Surface Reflectance Harmonized.
- Google Dynamic World.
- ReportLab.
- Pillow.
- JSON e GeoJSON.

Responsável por:

- Processar requisições de análise ambiental.
- Consultar imagens de satélite.
- Calcular indicadores de vegetação.
- Identificar possíveis mudanças de cobertura do solo.
- Comparar mudanças dentro e fora de polígonos declarados.
- Conferir a compatibilidade geográfica da localização.
- Consultar permissões fictícias do ambiente demonstrativo.
- Produzir relatórios estruturados em JSON.
- Gerar imagens de satélite para visualização.
- Produzir relatórios PDF.
- Informar a decisão experimental sobre emissão de token.

---

## 5. Monitoramento ambiental por satélite

### 5.1 Sentinel-2

Foi implementada uma integração com o Google Earth Engine utilizando a coleção:

`COPERNICUS/S2_SR_HARMONIZED`

A análise compara composições de imagens obtidas em dois períodos diferentes.

No cenário utilizado durante o desenvolvimento:

- Ano inicial: 2024.
- Ano final: 2025.
- Meses analisados: junho a setembro.
- Localização demonstrativa: latitude -12.5, longitude -54.5.
- Raio de análise: 1.000 metros.

O algoritmo calcula alterações no NDVI, índice utilizado para avaliar características da vegetação.

Uma queda no NDVI pode indicar mudanças na cobertura vegetal, mas também pode ser influenciada por sazonalidade, agricultura, nuvens e outros fatores.

### 5.2 Google Dynamic World

Foi utilizada a classificação de cobertura do solo do Google Dynamic World.

A análise identifica possíveis transições de áreas classificadas como árvores para outras classes, incluindo:

- Cultivos agrícolas.
- Gramíneas.
- Outras coberturas não arbóreas.

Os resultados são estimativas espaciais e não comprovam desmatamento, extração florestal ou ilegalidade.

### 5.3 Comparação com polígonos

O backend aceita geometrias GeoJSON dos tipos `Polygon` e `MultiPolygon`.

Com isso, a análise pode calcular separadamente:

- Mudanças dentro da área declarada.
- Mudanças fora da área declarada.
- Área total analisada.
- Indicadores de alteração arbórea.
- Indicadores de queda de NDVI.

A validade jurídica do polígono não é verificada automaticamente.

---

## 6. Experimentos com o satélite Amazônia-1

Também foi desenvolvido um componente experimental utilizando dados do satélite brasileiro **Amazônia-1**, disponibilizados pelo INPE.

O trabalho incluiu:

- Consulta a catálogo de imagens.
- Inventário de cenas disponíveis.
- Processamento experimental de bandas espectrais.
- Cálculo de NDVI.
- Comparações temporais.
- Organização de resultados em arquivos JSON.

Foi utilizado o produto Amazônia-1 WFI, com resolução espacial aproximada de 64 metros.

**Situação atual:** os resultados do Amazônia-1 são pré-processados para uma área demonstrativa. Não existe, no MVP, uma consulta dinâmica equivalente à implementação Sentinel-2 para qualquer propriedade.

Os indicadores do Amazônia-1 devem ser tratados como evidência complementar experimental, com limitações de qualidade e cobertura.

---

## 7. Permissões ambientais demonstrativas

Foi criado um conjunto de permissões fictícias armazenadas localmente em JSON.

O cenário principal utiliza:

```text
Permissao: DEMO-AUT-001
Produtor: PROD-001
Orgao emissor: ficticio
Atividade: supressao vegetal simulada
Validade: 2024 a 2026
Limite demonstrativo: 2 hectares
```

A permissão contém um polígono GeoJSON utilizado na comparação espacial.

**Esses dados não foram obtidos de órgãos ambientais e não possuem validade oficial.**

O limite demonstrativo de 2 hectares não deve ser confundido com a área total do polígono. Também não é possível determinar automaticamente o cumprimento desse limite apenas pela mudança de classe arbórea.

---

## 8. Verificação da localização

O backend recebe:

- Latitude.
- Longitude.
- Precisão estimada do GPS.
- Origem da localização.

O sistema compara o ponto informado com o polígono da permissão demonstrativa.

Na análise realizada durante o desenvolvimento, o ponto foi classificado como geograficamente compatível com a área informada.

Resultado de referência:

```text
Latitude: -12.5
Longitude: -54.5
Precisao declarada: 15 metros
Ponto dentro do poligono: sim
Distancia aproximada da borda: 398,1 metros
```

A compatibilidade geográfica não comprova que a fotografia foi capturada naquele local.

No aplicativo, a localização é registrada separadamente da imagem. A fotografia capturada não contém necessariamente coordenadas GPS em seus metadados EXIF.

---

## 9. Resultados obtidos durante os testes

Foi executada uma análise experimental utilizando Sentinel-2 e Dynamic World para os períodos de 2024 e 2025.

### Indicadores registrados

| Indicador | Resultado |
|---|---:|
| Possível mudança de cobertura arbórea | 1,3504 ha |
| Mudança arbórea dentro do polígono | 0,2523 ha |
| Mudança arbórea fora do polígono | 1,0981 ha |
| Área com queda de NDVI | 1,3733 ha |
| Transição de árvores para cultivo | 1,0690 ha |
| Transição de árvores para gramíneas | 0,0873 ha |

O resultado foi classificado como:

`divergencia_para_conferir`

A conclusão é que existem sinais de possível alteração da vegetação fora da área declarada, exigindo revisão.

**Esses valores não comprovam irregularidade ambiental nem atribuem responsabilidade ao produtor.**

---

## 10. Relatórios ambientais

Foram implementadas rotas para geração de relatórios ambientais.

### Relatório JSON

Endpoint:

`POST /relatorio/gerar`

Retorna informações como:

- Identificador do relatório.
- Data de geração.
- Status da análise.
- Resumo em linguagem simples.
- Referências do registro, produto e tentativa.
- Informações da permissão demonstrativa.
- Verificação de localização.
- Indicadores ambientais.
- Evidências e metodologia.

### Imagens de satélite

Endpoint:

`POST /imagens/satelite`

Gera visualizações de:

1. Antes da mudança.
2. Depois da mudança.
3. Possíveis alterações identificadas.

As imagens geradas pelo Earth Engine são evidências visuais experimentais dos períodos analisados.

Os links de visualização podem ser temporários.

### Relatório PDF

Endpoint:

`POST /relatorio/pdf`

Produz um documento contendo:

- Explicação acessível ao produtor.
- Imagens de antes e depois.
- Visualização de mudanças.
- Indicadores ambientais.
- Informações técnicas.
- Ressalvas metodológicas.

O PDF incorpora as imagens ao documento, permitindo sua visualização sem depender posteriormente das URLs temporárias.

---

## 11. Decisão experimental para emissão de token

O sistema prevê uma resposta padronizada chamada:

`decisao_token`

Exemplo de bloqueio:

```json
{
  "pode_emitir": false,
  "status": "revisao_necessaria",
  "motivo": "Possivel alteracao ambiental fora da area declarada.",
  "tipo_token": null
}
```

Exemplo de cenário favorável demonstrativo:

```json
{
  "pode_emitir": true,
  "status": "sem_alertas_detectados",
  "motivo": "Nenhuma divergencia identificada nos criterios analisados.",
  "tipo_token": "rastro_experimental"
}
```

O frontend é responsável pela geração do token ou QR Code.

**A emissão deve ser restrita ao ambiente de demonstração.** O token experimental representa um registro de rastreabilidade acompanhado de análise preliminar, não uma autorização ou certificação ambiental.

A integração completa da decisão deve ser conferida no código final, incluindo os nomes exatos dos status e os critérios de evidência suficiente.

---

## 12. Endpoints do backend

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/` | Informações da API |
| GET | `/saude` | Verificação de disponibilidade |
| GET | `/amazonia1/resumo` | Resultados experimentais Amazônia-1 |
| GET | `/amazonia1/inventario` | Inventário de cenas Amazônia-1 |
| GET | `/permissoes/demo` | Permissões fictícias |
| GET | `/relatorio/demo` | Relatório demonstrativo |
| POST | `/sentinel/analisar` | Análise Sentinel-2 |
| POST | `/relatorio/gerar` | Relatório ambiental JSON |
| POST | `/imagens/satelite` | Visualizações de satélite |
| POST | `/relatorio/pdf` | Relatório PDF |

Documentação interativa disponível em:

`http://localhost:8000/docs`

---

## 13. Como executar o backend

### Pré-requisitos

- Python.
- Dependências do projeto.
- Acesso configurado ao Google Earth Engine.
- Projeto Google Cloud habilitado para Earth Engine.

### Instalação

A partir da pasta `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Para autenticar o Earth Engine, quando necessário:

```bash
earthengine authenticate
```

Configure a variável de ambiente com um projeto Google Cloud ao qual você tenha acesso:

```bash
export EE_PROJECT="SEU_PROJETO_GOOGLE_CLOUD"
```

Inicie a API:

```bash
python -m uvicorn api.main:app --reload
```

Acesse:

`http://127.0.0.1:8000/docs`

As credenciais de autenticação não devem ser adicionadas ao GitHub.

---

## 14. Estratégia de demonstração do hackathon

A apresentação utiliza um fluxo híbrido.

### Funcionalidades reais

- Captura de foto pelo aplicativo.
- Captura de GPS do dispositivo.
- Registro local de informações.
- Backend FastAPI.
- Código de análise ambiental com Earth Engine.
- Geração de relatórios.
- Estrutura de decisão experimental.

### Funcionalidades demonstrativas

- Permissões ambientais fictícias.
- Propriedade de referência na região amazônica.
- Cenário de divergência ambiental.
- Cenário favorável simulado.
- Emissão de token demonstrativo.
- Imagens ilustrativas dos PDFs preparados para o pitch.

### Separação entre dados reais e fictícios

Durante a apresentação, o celular pode estar em São Paulo, enquanto a propriedade de demonstração está localizada em outra região.

O GPS real da captura **não deve ser apresentado como localização da propriedade fictícia**.

O aplicativo deve manter separadas:

- Localização real da captura.
- Localização demonstrativa da área analisada.
- Origem das evidências.
- Identificação do cenário simulado.

---

## 15. Testes realizados

Durante o desenvolvimento, foram verificados:

- Inicialização da API FastAPI.
- Conexão com o Google Earth Engine.
- Consulta a imagens Sentinel-2.
- Análise ambiental com polígono.
- Cálculo de mudanças dentro e fora da área.
- Consulta à base fictícia de permissões.
- Geração do relatório JSON.
- Geração e abertura de imagens do Earth Engine.
- Geração e abertura de PDF.
- Regras experimentais de decisão do token.

Também foram relatados testes automatizados utilizando respostas simuladas do Earth Engine.

**Limitações:** não foi demonstrado um teste completo ponta a ponta do aplicativo React com o backend em produção. Os testes simulados não substituem uma validação operacional completa do serviço real.

---

## 16. O que ainda falta implementar

### Integração

- Conectar os registros do React aos endpoints FastAPI.
- Associar corretamente foto, GPS, registro, produto e tentativa.
- Exibir os resultados ambientais no aplicativo.
- Disponibilizar o PDF para download.
- Gerar e visualizar o token demonstrativo.

### Evolução técnica

- Integrar bases oficiais de permissões ambientais.
- Validar geometrias e documentação de propriedades.
- Melhorar os filtros de qualidade das imagens.
- Incorporar métricas de confiança e incerteza.
- Tratar períodos sem imagens utilizáveis.
- Armazenar evidências e referências de forma persistente.
- Implementar autenticação e controle de acesso.
- Proteger os endpoints contra uso indevido.
- Adicionar testes automatizados de integração.
- Definir critérios técnicos para resultados inconclusivos.
- Validar o modelo com especialistas ambientais.

### Evolução da infraestrutura pública digital

- Documentar contratos de API.
- Adotar formatos interoperáveis.
- Estabelecer versionamento de métodos e dados.
- Criar mecanismos de auditoria.
- Permitir implantação por diferentes organizações.
- Estudar integração com plataformas públicas.
- Adaptar a solução a outros biomas e países.

---

## 17. Princípios do projeto

**Acessibilidade:** oferecer uma experiência compreensível para pequenos produtores.

**Transparência:** explicar como os resultados foram obtidos e quais são suas limitações.

**Interoperabilidade:** utilizar padrões abertos e interfaces documentadas.

**Escalabilidade:** permitir adaptação a diferentes regiões e instituições.

**Responsabilidade:** não confundir indicadores experimentais com comprovação de legalidade.

**Código aberto:** favorecer colaboração, auditoria e evolução coletiva.

---

## 18. Status do projeto

**Estado atual:** MVP experimental desenvolvido para hackathon.

O núcleo geoespacial foi implementado e testado em cenários de referência. A geração de relatórios JSON, imagens e PDF foi demonstrada. A integração final com o aplicativo e a emissão de tokens demonstrativos fazem parte da etapa de consolidação do MVP.

O projeto não deve ser utilizado para certificação ambiental oficial ou decisões regulatórias sem validação técnica, jurídica e institucional adicional.

---

## 19. Visão de futuro

O Rastro Florestal pretende evoluir para uma infraestrutura digital aberta que facilite o registro de origem e a organização de evidências ambientais de produtos florestais.

A proposta de longo prazo é oferecer componentes reutilizáveis para pequenos produtores, cooperativas, compradores e instituições públicas, com possibilidade de expansão para diferentes biomas e países da América do Sul.

**Rastro Florestal — tecnologia aberta para aproximar pequenos produtores da rastreabilidade digital e do monitoramento ambiental.**
