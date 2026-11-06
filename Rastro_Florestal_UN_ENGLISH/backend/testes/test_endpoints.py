"""Run: python -m unittest discover -s testes -v. Earth Engine and imagery are mocked."""
import io
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image as PILImage
from api.main import app

C = TestClient(app)
P = dict(permissao_id='DEMO-AUT-001', latitude=-12.5, longitude=-54.5, precisao_metros=15,
         origem_localizacao='device', raio_metros=1000, ano_inicial=2024, ano_final=2025,
         registro_id='REG-001', produto_id='PRODUTO-001', tentativa_id='TENT-001')


def sat(fora=1.0981):
    dentro = .2523
    return dict(status='experimental', fonte='Sentinel-2 SR + Google Dynamic World', anos=[2024, 2025],
                cenas_sentinel=[42, 61], cenas_dynamic_world=[45, 56],
                arvore_para_nao_arvore_ha=round(dentro+fora, 4),
                arvore_para_nao_arvore_dentro_autorizacao_ha=dentro,
                arvore_para_nao_arvore_fora_autorizacao_ha=fora, queda_ndvi_ha=1.3733)


def imgs(*args, **kwargs):
    return {'imagens_antes_depois': [{'tipo': t, 'url': 'https://earthengine.googleapis.com/mock'} for t in ('antes','depois','mudancas')]}


def png(*args, **kwargs):
    b=io.BytesIO(); PILImage.new('RGB',(400,400),'#d9e6d9').save(b,'PNG'); b.seek(0); return b

class Endpoints(unittest.TestCase):
    def test_basicos(self):
        for rota in ('/', '/saude', '/permissoes/demo', '/amazonia1/resumo', '/amazonia1/inventario', '/relatorio/demo', '/openapi.json', '/docs'):
            with self.subTest(rota=rota): self.assertEqual(C.get(rota).status_code,200)

    def test_sentinel(self):
        with patch('api.earth_engine.analisar_sentinel', return_value=sat()):
            r=C.post('/sentinel/analisar', json=P)
            self.assertEqual(r.status_code,200, r.text)

    def test_relatorio_divergencia(self):
        with patch('api.earth_engine.analisar_sentinel', return_value=sat()):
            r=C.post('/relatorio/gerar',json=P)
            self.assertEqual(r.status_code,200,r.text)
            self.assertEqual(r.json()['status'],'divergencia_para_conferir')
            self.assertFalse(r.json()['decisao_token']['pode_emitir'])

    def test_relatorio_favoravel_simulado(self):
        with patch('api.earth_engine.analisar_sentinel', return_value=sat(0)):
            r=C.post('/relatorio/gerar',json=P)
            self.assertEqual(r.status_code,200,r.text)
            self.assertEqual(r.json()['status'],'sem_divergencia_detectada_nesta_analise')
            self.assertTrue(r.json()['decisao_token']['pode_emitir'])
            self.assertEqual(r.json()['decisao_token']['tipo_token'],'rastro_experimental')

    def test_sem_gps_nao_emite(self):
        with patch('api.earth_engine.analisar_sentinel', return_value=sat(0)):
            r=C.post('/relatorio/gerar',json={**P,'origem_localizacao':'demo'})
            self.assertFalse(r.json()['decisao_token']['pode_emitir'])

    def test_imagens(self):
        with patch('api.imagens.iniciar_ee', side_effect=RuntimeError('Mock sem EE')):
            r=C.post('/imagens/satelite',json=P)
            self.assertEqual(r.status_code,503)
        with patch('api.imagens.imagens_satelite', return_value=imgs()):
            self.assertEqual(len(imgs()['imagens_antes_depois']),3)

    def test_pdf(self):
        with patch('api.earth_engine.analisar_sentinel',return_value=sat()), \
             patch('api.imagens.imagens_satelite',side_effect=imgs), \
             patch('api.pdf_relatorio._baixar_imagem',side_effect=png):
            r=C.post('/relatorio/pdf',json=P)
            self.assertEqual(r.status_code,200,r.text[:300] if r.status_code!=200 else '')
            self.assertTrue(r.content.startswith(b'%PDF-'))
            self.assertGreater(len(r.content),3000)

    def test_validacao(self):
        self.assertEqual(C.post('/relatorio/gerar',json={**P,'ano_inicial':2025,'ano_final':2024}).status_code,422)
        self.assertEqual(C.post('/relatorio/gerar',json={**P,'permissao_id':'NAO-EXISTE'}).status_code,404)

if __name__=='__main__': unittest.main()
