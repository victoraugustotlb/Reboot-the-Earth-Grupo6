"""PDF report with satellite-derived evidence; not an environmental certification."""
from io import BytesIO
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, KeepTogether, PageBreak
from PIL import Image as PILImage

router = APIRouter(tags=['Environmental PDF report'])


def _baixar_imagem(url):
    """Fetch an Earth Engine image only to embed it in the PDF."""
    parsed = urlparse(url)
    host = (parsed.hostname or '').lower()
    if parsed.scheme != 'https' or not (host == 'googleapis.com' or host.endswith('.googleapis.com') or host == 'googleusercontent.com' or host.endswith('.googleusercontent.com')):
        raise ValueError('Unexpected image URL; PDF generation stopped.')
    with urlopen(Request(url, headers={'User-Agent': 'GeoAI-MVP/1.0'}), timeout=90) as resposta:
        dados = resposta.read(12 * 1024 * 1024 + 1)
    if len(dados) > 12 * 1024 * 1024:
        raise ValueError('Image exceeds the allowed size.')
    with PILImage.open(BytesIO(dados)) as img:
        img.verify()
    return BytesIO(dados)


def _p(valor, casas=2):
    return 'Not calculated' if valor is None else f'{valor:.{casas}f}'.replace('.', ',')


def montar_pdf(relatorio, imagens):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=1.65*cm, rightMargin=1.65*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm, title='Rastro Florestal - Environmental report')
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='TituloRF', parent=s['Title'], fontName='Helvetica-Bold', fontSize=19, leading=23, textColor=colors.HexColor('#195b42'), spaceAfter=9))
    s.add(ParagraphStyle(name='SubRF', parent=s['Heading2'], fontSize=11, leading=15, textColor=colors.HexColor('#195b42'), spaceBefore=12, spaceAfter=6))
    s.add(ParagraphStyle(name='TextoRF', parent=s['BodyText'], fontSize=10, leading=15, spaceAfter=8))
    s.add(ParagraphStyle(name='PeqRF', parent=s['BodyText'], fontSize=8, leading=11, textColor=colors.HexColor('#555e58')))
    s.add(ParagraphStyle(name='ImgRF', parent=s['BodyText'], fontSize=9, leading=12, alignment=TA_CENTER, spaceAfter=4))
    def txt(v): return escape(str(v or ''))
    historia = [Paragraph('RASTRO FLORESTAL', s['TituloRF']),
                Paragraph('<b>DEMONSTRATION REPORT - FICTIONAL PERMIT</b>', s['PeqRF']),
                Spacer(1, 0.25*cm), Paragraph('What does the satellite analysis show?', s['SubRF']),
                Paragraph(txt(relatorio['resumo_produtor']['mensagem']), s['TextoRF']),
                Paragraph('These findings call for review; they are neither an accusation nor proof of a violation.', s['TextoRF'])]
    ind = relatorio['indicadores']
    tabela = Table([
        ['Estimated tree-cover class change', f"{_p(ind.get('mudanca_arborea_total_ha'))} ha"],
        ['Inside the declared area', f"{_p(ind.get('mudanca_arborea_dentro_ha'))} ha"],
        ['Outside the declared area', f"{_p(ind.get('mudanca_arborea_fora_ha'))} ha"],
    ], colWidths=[11.1*cm, 5.7*cm])
    tabela.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#eef4ee')),
                                ('ROWBACKGROUNDS',(0,0),(-1,-1),[colors.HexColor('#eef4ee'),colors.white]),
                                ('TEXTCOLOR',(0,0),(-1,-1),colors.HexColor('#243b2e')),
                                ('FONTNAME',(0,0),(-1,-1),'Helvetica'),('FONTSIZE',(0,0),(-1,-1),9),
                                ('BOTTOMPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10),
                                ('LINEBELOW',(0,0),(-1,-1),0.4,colors.HexColor('#d5dfd6'))]))
    historia.extend([tabela, Paragraph('Satellite image composites used', s['SubRF'])])
    itens = imagens.get('imagens_antes_depois', [])
    tipos = {item.get('tipo'): item for item in itens}
    if not all(k in tipos for k in ('antes', 'depois', 'mudancas')):
        raise ValueError('Earth Engine did not return all three required images.')
    # Two side-by-side images and a larger change map, all embedded in the PDF.
    pares = []
    for tipo in ('antes','depois'):
        blob = _baixar_imagem(tipos[tipo]['url'])
        pares.append(Image(blob, width=7.9*cm, height=7.9*cm, kind='proportional'))
    linha = Table([pares, [Paragraph('BEFORE - '+str(relatorio['evidencias']['analise_satelite']['anos'][0]), s['ImgRF']),
                            Paragraph('AFTER - '+str(relatorio['evidencias']['analise_satelite']['anos'][1]), s['ImgRF'])]],
                   colWidths=[8.3*cm,8.3*cm])
    linha.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(0,0),(-1,-1),'CENTER')]))
    historia.append(linha)
    historia.append(Paragraph('Composites cover June through September of each year, not a single acquisition date.', s['PeqRF']))
    historia.append(PageBreak())
    historia.extend([Paragraph('Where were potential changes detected?', s['TituloRF']),
                     Paragraph('Orange: pixels classified as trees before and another land-cover class after. Blue: declared area boundary.', s['TextoRF'])])
    blob = _baixar_imagem(tipos['mudancas']['url'])
    historia.append(Image(blob, width=15.5*cm, height=13.5*cm, kind='proportional'))
    historia.append(Spacer(1,0.3*cm))
    historia.append(Paragraph('Review information', s['SubRF']))
    loc = relatorio['localizacao']
    ref = relatorio.get('referencias',{})
    per = relatorio['permissao']
    location_labels = {'compativel_geograficamente': 'Geographically compatible', 'divergencia_para_conferir': 'Review required', 'evidencia_insuficiente': 'Insufficient evidence'}
    location_status = loc['verificacao'].get('situacao')
    infos = [f"Report: {relatorio['id_relatorio']} | Generated: {relatorio['gerado_em_utc']}",
             f"Fictional permit: {per['id']} | Source: FICTIONAL DATABASE - NOT OFFICIAL",
             f"Record: {ref.get('registro_id') or '-'} | Product: {ref.get('produto_id') or '-'} | Attempt: {ref.get('tentativa_id') or '-'}",
             f"Reported GPS: {loc['latitude']}, {loc['longitude']} | Source: {loc['origem']}",
             f"Geographic assessment: {location_labels.get(location_status, 'Not assessed')}",
             'Sources: Sentinel-2 SR Harmonized and Google Dynamic World.',
             'Method: geoai-relatorio-demo-1.0 | Experimental analysis.']
    historia.extend(Paragraph(txt(t),s['PeqRF']) for t in infos)
    historia.append(Spacer(1,0.3*cm))
    historia.append(Paragraph('<b>IMPORTANT:</b> The permit is entirely fictional. Satellite-derived land-cover changes do not prove clearing, extraction, or illegality. The fictional hectare limit has not been validated. No detected signal does not prove the absence of extraction.', s['PeqRF']))
    doc.build(historia)
    return buffer.getvalue()


from api.main import RelatorioRequest

@router.post('/pdf', response_class=Response, summary='Generate a PDF report with satellite imagery')
def gerar_pdf(pedido: RelatorioRequest):
    from api.main import AnaliseRequest, RelatorioRequest
    from api.relatorios import gerar_relatorio, obter_permissao
    from api.earth_engine import analisar_sentinel
    from api.imagens import imagens_satelite, ImagensRequest
    try:
        relatorio = gerar_relatorio(pedido, analisar_sentinel, AnaliseRequest)
        from api.token import decidir_token
        relatorio['decisao_token'] = decidir_token(relatorio)
        permissao = obter_permissao(pedido.permissao_id)
        imagens = imagens_satelite(ImagensRequest(latitude=pedido.latitude, longitude=pedido.longitude,
                    raio_metros=pedido.raio_metros, ano_inicial=pedido.ano_inicial,
                    ano_final=pedido.ano_final, poligono_autorizado=permissao['area_autorizada']))
        pdf = montar_pdf(relatorio, imagens)
        nome = f"rastro_florestal_{relatorio['id_relatorio']}.pdf"
        return Response(content=pdf, media_type='application/pdf',
                        headers={'Content-Disposition': f'attachment; filename="{nome}"'})
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Could not generate the PDF report: {exc}') from exc
