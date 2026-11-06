"""Integration endpoints: preserve the imported model and never fabricate live imagery."""
import base64
import os
from datetime import datetime, timezone
from io import BytesIO
from uuid import uuid4
from xml.sax.saxutils import escape
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from api.main import RelatorioRequest, AnaliseRequest, amazonia_resumo
from api.relatorios import gerar_relatorio, obter_permissao
from api.token import decidir_token

router = APIRouter(prefix='/integracao', tags=['Verdefica integration'])

class PedidoIntegrado(BaseModel):
    modo: Literal['live', 'reference']
    pedido: RelatorioRequest

@router.get('/status')
def status():
    # Presence is not proof that the account has Earth Engine access.
    return {'status': 'ok', 'ee_project_configured': bool(os.getenv('EE_PROJECT', '').strip()),
            'reference_available': True, 'photo_visual_ai': False}

def pdf_sem_imagens(report):
    """Readable report of the exact stored result; missing images are not replaced by illustrations."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=1.8*cm, rightMargin=1.8*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm, title='Verdefica - Environmental screening')
    styles = getSampleStyleSheet()
    def p(value, style='BodyText'):
        return Paragraph(escape(str(value)), styles[style])
    content = [p('VERDEFICA', 'Title'), p('Experimental environmental screening', 'Heading2'),
               p('DEMONSTRATION ONLY - FICTIONAL PERMIT. Not a legal certificate.'), Spacer(1, .4*cm),
               p(report['id_relatorio'], 'Heading3'), p(report['gerado_em_utc']),
               p(report['resumo_produtor']['mensagem']), Spacer(1, .3*cm)]
    decision = report['decisao_token']
    content += [p('Token decision', 'Heading2'), p(decision['status']), p(decision['motivo'])]
    values = report.get('indicadores', {})
    names = {'mudanca_arborea_total_ha': 'Tree-cover class change (ha)',
             'mudanca_arborea_dentro_ha': 'Inside declared polygon (ha)',
             'mudanca_arborea_fora_ha': 'Outside declared polygon (ha)',
             'queda_ndvi_total_ha': 'Area with NDVI decline (ha)'}
    rows = [[p(title), p('Not calculated' if values.get(key) is None else values[key])] for key, title in names.items()]
    table = Table(rows, colWidths=[10*cm, 6*cm])
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#edf4ec')), ('VALIGN',(0,0),(-1,-1),'TOP'),
                               ('TOPPADDING',(0,0),(-1,-1),9), ('BOTTOMPADDING',(0,0),(-1,-1),9)]))
    content += [Spacer(1,.4*cm), table, p('Evidence and limitations', 'Heading2')]
    for notice in report.get('avisos_integracao', []):
        content += [p(notice), Spacer(1,.15*cm)]
    content += [p('References', 'Heading2')]
    for key, value in report.get('referencias', {}).items(): content.append(p(f'{key}: {value or "-"}'))
    content.append(p('No satellite image is embedded in this version. Missing imagery is not evidence of absence of change.'))
    doc.build(content)
    return buffer.getvalue()

def reference_report(pedido):
    data = amazonia_resumo()
    analysis = data['comparacao_2024_2025']
    return {'id_relatorio': 'REF-AMZ1-' + uuid4().hex[:12].upper(),
            'gerado_em_utc': datetime.now(timezone.utc).isoformat(), 'ambiente': 'DEMONSTRACAO',
            'status': 'evidencia_insuficiente', 'modo_integracao': 'reference',
            'resumo_produtor': {'mensagem': 'Precomputed Amazonia-1 reference dataset only. This is not an assessment of the registered property.'},
            'referencias': {'registro_id': pedido.registro_id, 'produto_id': pedido.produto_id, 'tentativa_id': pedido.tentativa_id},
            'area_referencia': {'latitude': -12.5, 'longitude': -54.5, 'origem': 'demo'},
            'indicadores': {'mudanca_arborea_total_ha': None, 'mudanca_arborea_dentro_ha': None,
                           'mudanca_arborea_fora_ha': None, 'queda_ndvi_total_ha': analysis.get('changed_hectares')},
            'amazonia1_referencia': data,
            'decisao_token': {'pode_emitir': False, 'status': 'evidencias_insuficientes',
                              'motivo': 'Reference data do not establish satellite or GPS evidence for this property.', 'tipo_token': None},
            'avisos_integracao': ['Amazonia-1 data are precomputed for a fixed demonstration area.',
                                  'The reference coordinates are separate from the device capture coordinates.',
                                  'No live Earth Engine query or visual photo AI was run.',
                                  'Fictional permit. No certification or environmental legality determination.']}

@router.post('/analisar')
def analisar(payload: PedidoIntegrado):
    if payload.modo == 'reference':
        report = reference_report(payload.pedido)
        pdf = pdf_sem_imagens(report)
    else:
        from api.earth_engine import analisar_sentinel
        try:
            report = gerar_relatorio(payload.pedido, analisar_sentinel, AnaliseRequest)
            report['decisao_token'] = decidir_token(report)
            report['modo_integracao'] = 'live'
            report['avisos_integracao'] = ['Fictional permit, not a regulatory authorization.',
                'Device GPS and photo provenance are not independently verified.',
                'Satellite indicators are experimental and require human review.']
            try:
                from api.imagens import imagens_satelite, ImagensRequest
                from api.pdf_relatorio import montar_pdf
                images = imagens_satelite(ImagensRequest(latitude=payload.pedido.latitude, longitude=payload.pedido.longitude,
                    raio_metros=payload.pedido.raio_metros, ano_inicial=payload.pedido.ano_inicial,
                    ano_final=payload.pedido.ano_final, poligono_autorizado=obter_permissao(payload.pedido.permissao_id)['area_autorizada']))
                pdf = montar_pdf(report, images)
            except Exception:
                report['avisos_integracao'].append('Satellite previews were unavailable; PDF includes the analytical result without imagery.')
                pdf = pdf_sem_imagens(report)
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except HTTPException:
            raise
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except Exception as error:
            raise HTTPException(status_code=502, detail='Satellite analysis could not be completed.') from error
    return {'report': report, 'pdf_base64': base64.b64encode(pdf).decode('ascii')}
