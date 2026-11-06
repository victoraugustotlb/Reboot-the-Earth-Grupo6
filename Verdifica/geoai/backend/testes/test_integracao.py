import base64
import io
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image
from api.main import app

C = TestClient(app)
P = dict(permissao_id='DEMO-AUT-001', latitude=-12.5, longitude=-54.5, origem_localizacao='demo',
         registro_id='r-1', produto_id='p-1', tentativa_id=None, ano_inicial=2024, ano_final=2025)

class Integration(unittest.TestCase):
    def test_reference_pdf_without_earth_engine(self):
        with patch('api.earth_engine.analisar_sentinel', side_effect=AssertionError('Must not query Earth Engine')):
            response = C.post('/integracao/analisar', json={'modo': 'reference', 'pedido': P})
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertFalse(data['report']['decisao_token']['pode_emitir'])
        self.assertEqual(data['report']['referencias']['registro_id'], 'r-1')
        self.assertIsNone(data['report']['indicadores']['mudanca_arborea_fora_ha'])
        self.assertTrue(base64.b64decode(data['pdf_base64']).startswith(b'%PDF-'))
    def test_missing_credentials_is_not_a_favorable_result(self):
        with patch('api.earth_engine.analisar_sentinel', side_effect=RuntimeError('EE_PROJECT missing')):
            response = C.post('/integracao/analisar', json={'modo': 'live', 'pedido': {**P, 'origem_localizacao': 'device'}})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('report', response.json())
    def test_real_image_check_does_not_claim_visual_ai_or_issue_tokens(self):
        image = io.BytesIO(); Image.new('RGB', (400, 400), '#446633').save(image, 'PNG')
        response = C.post('/imagem/analisar', data={'produto_declarado': 'Madeira'}, files={'foto': ('test.png', image.getvalue(), 'image/png')})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['produto_aparentemente_compativel'])
        self.assertFalse(response.json()['pode_emitir_token'])
        self.assertEqual(response.json()['modo'], 'simulado_sem_ia')
    def test_invalid_photo_and_years(self):
        self.assertEqual(C.post('/imagem/analisar', data={'produto_declarado': 'Madeira'}, files={'foto': ('fake.png', b'not a photo', 'image/png')}).status_code, 400)
        self.assertEqual(C.post('/integracao/analisar', json={'modo': 'live', 'pedido': {**P, 'ano_inicial': 2025, 'ano_final': 2024}}).status_code, 422)
