"""Environmental monitoring MVP API. Run: uvicorn api.main:app --reload"""
import json
from pathlib import Path
from typing import Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

ROOT = Path(__file__).resolve().parent.parent
RESULTADOS = ROOT / 'resultados'
app = FastAPI(title='Rastro Florestal - Environmental Monitoring', version='0.1.0',
              description='Experimental indicators, not legal certification.')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:3000', 'http://localhost:5173',
                                                  'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
                   allow_methods=['*'], allow_headers=['*'])

class AnaliseRequest(BaseModel):
    latitude: float = Field(default=-12.5, ge=-90, le=90)
    longitude: float = Field(default=-54.5, ge=-180, le=180)
    raio_metros: int = Field(default=1000, ge=100, le=5000)
    ano_inicial: int = Field(default=2024, ge=2016, le=2030)
    ano_final: int = Field(default=2025, ge=2016, le=2030)
    poligono_autorizado: Optional[dict[str, Any]] = None

    @model_validator(mode='after')
    def validar_anos(self):
        if self.ano_final <= self.ano_inicial:
            raise ValueError('end year must be greater than start year')
        if self.poligono_autorizado is not None and self.poligono_autorizado.get('type') not in ('Polygon', 'MultiPolygon'):
            raise ValueError('declared polygon must be a GeoJSON Polygon or MultiPolygon')
        return self


def carregar(nome):
    arquivo = RESULTADOS / nome
    if not arquivo.is_file():
        raise HTTPException(status_code=404, detail=f'Missing file: resultados/{nome}')
    try:
        return json.loads(arquivo.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f'Unable to read {nome}: {exc}') from exc

@app.get('/')
def inicio():
    return {'nome': 'GeoAI', 'status': 'online', 'documentacao': '/docs',
            'aviso': 'Experimental results; they do not establish legal compliance.'}

@app.get('/saude')
def saude():
    return {'status': 'ok'}

@app.get('/amazonia1/resumo')
def amazonia_resumo():
    comparacao = carregar('relatorio_amazonia1.json')
    analise_2024_2025 = carregar('analise_amazonia1.json')
    serie = carregar('serie_ndvi_amazonia1.json')
    inventario = carregar('inventario_amazonia1.json')
    return {
        'fonte': 'Amazonia-1 WFI (INPE)', 'status': 'experimental',
        'comparacao_2025': comparacao,
        'comparacao_2024_2025': analise_2024_2025,
        'serie_temporal': serie,
        'cenas_catalogadas': inventario.get('scene_count', len(inventario.get('scenes', []))),
        'aviso': 'Precomputed data for a demonstration area; not a real-time query.'
    }

@app.get('/amazonia1/inventario')
def amazonia_inventario():
    return carregar('inventario_amazonia1.json')

@app.post('/sentinel/analisar')
def sentinel_analisar(pedido: AnaliseRequest):
    try:
        from api.earth_engine import analisar_sentinel
        return analisar_sentinel(pedido)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Earth Engine error: {exc}') from exc

@app.get('/relatorio/demo')
def relatorio_demo():
    dados = amazonia_resumo()
    return {
        'tipo': 'evidencia_ambiental_experimental',
        'localizacao_demo': {'latitude': -12.5, 'longitude': -54.5},
        'amazonia1': dados,
        'sentinel': {'status': 'nao_executado', 'instrucao': 'POST /sentinel/analisar'},
        'conclusao': 'These data cannot certify legal compliance.'
    }

# Simplified report using entirely fictional permits.
class RelatorioRequest(BaseModel):
    permissao_id: str = Field(default='DEMO-AUT-001')
    latitude: float = Field(default=-12.5, ge=-90, le=90)
    longitude: float = Field(default=-54.5, ge=-180, le=180)
    precisao_metros: Optional[float] = Field(default=15, ge=0)
    origem_localizacao: str = Field(default='device', pattern='^(device|demo|ausente)$')
    raio_metros: int = Field(default=1000, ge=100, le=5000)
    ano_inicial: int = Field(default=2024, ge=2016, le=2030)
    ano_final: int = Field(default=2025, ge=2016, le=2030)
    registro_id: Optional[str] = None
    produto_id: Optional[str] = None
    tentativa_id: Optional[str] = None

    @model_validator(mode='after')
    def validar_anos_relatorio(self):
        if self.ano_final <= self.ano_inicial:
            raise ValueError('end year must be greater than start year')
        return self


@app.get('/permissoes/demo')
def permissoes_demo():
    from api.relatorios import listar_permissoes
    return listar_permissoes()


@app.post('/relatorio/gerar')
def relatorio_gerar(pedido: RelatorioRequest):
    from api.relatorios import gerar_relatorio
    from api.earth_engine import analisar_sentinel
    try:
        from api.token import decidir_token
        relatorio = gerar_relatorio(pedido, analisar_sentinel, AnaliseRequest)
        relatorio['decisao_token'] = decidir_token(relatorio)
        return relatorio
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Failed to generate report: {exc}') from exc

from api.imagens import router as imagens_router
app.include_router(imagens_router)

from api.pdf_relatorio import router as pdf_router
app.include_router(pdf_router, prefix="/relatorio")

from api.fotos_ia import router as photos_router
app.include_router(photos_router)

# Integration reuses the model above and adds an explicitly non-approving reference mode.
from api.integracao import router as integration_router
app.include_router(integration_router)
