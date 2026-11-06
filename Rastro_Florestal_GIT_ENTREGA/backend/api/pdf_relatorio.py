"""PDF completo com evidencias reais; nao e certificacao ambiental."""
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

router = APIRouter(tags=['Relatorio PDF'])


def _baixar_imagem(url):
    """Busca a imagem gerada pelo Earth Engine apenas para embutir no PDF."""
    parsed = urlparse(url)
    host = (parsed.hostname or '').lower()
    if parsed.scheme != 'https' or not (host == 'googleapis.com' or host.endswith('.googleapis.com') or host == 'googleusercontent.com' or host.endswith('.googleusercontent.com')):
        raise ValueError('URL de imagem inesperada; geracao interrompida.')
    with urlopen(Request(url, headers={'User-Agent': 'GeoAI-MVP/1.0'}), timeout=90) as resposta:
        dados = resposta.read(12 * 1024 * 1024 + 1)
    if len(dados) > 12 * 1024 * 1024:
        raise ValueError('Imagem maior que o limite permitido.')
    with PILImage.open(BytesIO(dados)) as img:
        img.verify()
    return BytesIO(dados)


def _p(valor, casas=2):
    return 'Nao calculado' if valor is None else f'{valor:.{casas}f}'.replace('.', ',')


def montar_pdf(relatorio, imagens):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=1.65*cm, rightMargin=1.65*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm, title='Rastro Florestal - Relatorio ambiental')
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(name='TituloRF', parent=s['Title'], fontName='Helvetica-Bold', fontSize=19, leading=23, textColor=colors.HexColor('#195b42'), spaceAfter=9))
    s.add(ParagraphStyle(name='SubRF', parent=s['Heading2'], fontSize=11, leading=15, textColor=colors.HexColor('#195b42'), spaceBefore=12, spaceAfter=6))
    s.add(ParagraphStyle(name='TextoRF', parent=s['BodyText'], fontSize=10, leading=15, spaceAfter=8))
    s.add(ParagraphStyle(name='PeqRF', parent=s['BodyText'], fontSize=8, leading=11, textColor=colors.HexColor('#555e58')))
    s.add(ParagraphStyle(name='ImgRF', parent=s['BodyText'], fontSize=9, leading=12, alignment=TA_CENTER, spaceAfter=4))
    def txt(v): return escape(str(v or ''))
    historia = [Paragraph('RASTRO FLORESTAL', s['TituloRF']),
                Paragraph('<b>RELATORIO DE DEMONSTRACAO - PERMISSAO FICTICIA</b>', s['PeqRF']),
                Spacer(1, 0.25*cm), Paragraph('Como esta sua area?', s['SubRF']),
                Paragraph(txt(relatorio['resumo_produtor']['mensagem']), s['TextoRF']),
                Paragraph('Isso e um sinal para conferencia, nao uma acusacao nem prova de irregularidade.', s['TextoRF'])]
    ind = relatorio['indicadores']
    tabela = Table([
        ['Mudanca estimada na cobertura de arvores', f"{_p(ind.get('mudanca_arborea_total_ha'))} ha"],
        ['Dentro da area informada', f"{_p(ind.get('mudanca_arborea_dentro_ha'))} ha"],
        ['Fora da area informada', f"{_p(ind.get('mudanca_arborea_fora_ha'))} ha"],
    ], colWidths=[11.1*cm, 5.7*cm])
    tabela.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#eef4ee')),
                                ('ROWBACKGROUNDS',(0,0),(-1,-1),[colors.HexColor('#eef4ee'),colors.white]),
                                ('TEXTCOLOR',(0,0),(-1,-1),colors.HexColor('#243b2e')),
                                ('FONTNAME',(0,0),(-1,-1),'Helvetica'),('FONTSIZE',(0,0),(-1,-1),9),
                                ('BOTTOMPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10),
                                ('LINEBELOW',(0,0),(-1,-1),0.4,colors.HexColor('#d5dfd6'))]))
    historia.extend([tabela, Paragraph('Imagens reais utilizadas', s['SubRF'])])
    itens = imagens.get('imagens_antes_depois', [])
    tipos = {item.get('tipo'): item for item in itens}
    if not all(k in tipos for k in ('antes', 'depois', 'mudancas')):
        raise ValueError('Earth Engine nao retornou as tres imagens necessarias.')
    # Duas imagens lado a lado e mapa de mudancas maior, tudo embutido no PDF.
    pares = []
    for tipo in ('antes','depois'):
        blob = _baixar_imagem(tipos[tipo]['url'])
        pares.append(Image(blob, width=7.9*cm, height=7.9*cm, kind='proportional'))
    linha = Table([pares, [Paragraph('ANTES - '+str(relatorio['evidencias']['analise_satelite']['anos'][0]), s['ImgRF']),
                            Paragraph('DEPOIS - '+str(relatorio['evidencias']['analise_satelite']['anos'][1]), s['ImgRF'])]],
                   colWidths=[8.3*cm,8.3*cm])
    linha.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(0,0),(-1,-1),'CENTER')]))
    historia.append(linha)
    historia.append(Paragraph('Imagens compostas de junho a setembro de cada ano; nao sao fotos de um dia especifico.', s['PeqRF']))
    historia.append(PageBreak())
    historia.extend([Paragraph('Onde apareceram possiveis mudancas?', s['TituloRF']),
                     Paragraph('Laranja: pixels classificados como arvores antes e outra cobertura depois. Azul: limite da area informada.', s['TextoRF'])])
    blob = _baixar_imagem(tipos['mudancas']['url'])
    historia.append(Image(blob, width=15.5*cm, height=13.5*cm, kind='proportional'))
    historia.append(Spacer(1,0.3*cm))
    historia.append(Paragraph('Dados para conferencia', s['SubRF']))
    loc = relatorio['localizacao']
    ref = relatorio.get('referencias',{})
    per = relatorio['permissao']
    infos = [f"Relatorio: {relatorio['id_relatorio']} | Gerado: {relatorio['gerado_em_utc']}",
             f"Permissao de exemplo: {per['id']} | Fonte: BASE FICTICIA - NAO OFICIAL",
             f"Registro: {ref.get('registro_id') or '-'} | Produto: {ref.get('produto_id') or '-'} | Tentativa: {ref.get('tentativa_id') or '-'}",
             f"GPS informado: {loc['latitude']}, {loc['longitude']} | Origem: {loc['origem']}",
             f"Situacao geografica: {loc['verificacao'].get('situacao', 'nao avaliada')}",
             'Fontes: Sentinel-2 SR Harmonized e Google Dynamic World.',
             'Metodo: geoai-relatorio-demo-1.0 | Analise experimental.']
    historia.extend(Paragraph(txt(t),s['PeqRF']) for t in infos)
    historia.append(Spacer(1,0.3*cm))
    historia.append(Paragraph('<b>IMPORTANTE:</b> A permissao e inteiramente ficticia. A mudanca de classe estimada por satelite nao comprova supressao, extracao ou ilegalidade. O limite de hectares autorizado nao foi validado. A ausencia de sinal tambem nao comprova ausencia de extracao.', s['PeqRF']))
    doc.build(historia)
    return buffer.getvalue()


from api.main import RelatorioRequest

@router.post('/pdf', response_class=Response, summary='Gerar PDF completo com imagens de satelite')
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
        raise HTTPException(status_code=502, detail=f'Nao foi possivel gerar PDF completo: {exc}') from exc
