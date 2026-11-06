import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// O QR pode apontar para um novo registro ou para um produto da API anterior.
export function Trace({ id }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api(`/api/records/${encodeURIComponent(id)}/trace`)
      .catch(async (error) => {
        if (error.status !== 404) throw error;
        const product = await api(`/api/products/${encodeURIComponent(id)}`);
        return {
          id: product.id,
          hash: product.hash,
          products: [
            {
              id: product.id,
              species: product.tree_species,
              before: [{ id: 'before', photo: product.photo_before }],
              after: product.photo_after ? [{ id: 'after', photo: product.photo_after }] : [],
            },
          ],
        };
      })
      .then((data) => {
        if (active) setRecord(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <main className="trace-page">
      <section className="form-card">
        <span className="eyebrow">VERDEFICA · RASTREABILIDADE PÚBLICA</span>
        <h1>Origem registrada.</h1>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : !record ? (
          <p role="status">Consultando registro…</p>
        ) : (
          <>
            <p className="small">ID: {record.id}</p>
            <p className="small hash">SHA-256: {record.hash}</p>
            {record.products.map((product, index) => (
              <article key={product.id} className="product-card">
                <h2>
                  Produto {index + 1} · {product.species || 'Espécie não informada'}
                </h2>
                {product.productType && <p>Tipo de produto: {product.productType}</p>}
                {['before', 'after'].map((phase) => (
                  <section key={phase}>
                    <h3>{phase === 'before' ? 'Antes da extração' : 'Depois da extração'}</h3>
                    {product[phase].length ? (
                      <div className="trace-photos">
                        {product[phase].map((attempt) => (
                          <figure key={attempt.id}>
                            <img
                              src={attempt.photo}
                              alt={`Evidência ${phase === 'before' ? 'anterior' : 'posterior'} à extração`}
                            />
                            <figcaption>
                              {attempt.number && `Tentativa ${attempt.number} · `}
                              {attempt.location
                                ? `${attempt.location.source === 'demo' ? 'Demonstração' : 'Posição aproximada'}: ${attempt.location.latitude}, ${attempt.location.longitude}`
                                : 'Sem localização'}
                              {attempt.capturedAt &&
                                ` · ${new Date(attempt.capturedAt).toLocaleString('pt-BR')}`}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p>Evidência ainda não registrada.</p>
                    )}
                  </section>
                ))}
              </article>
            ))}
          </>
        )}
        <p className="small muted">
          Informações declaradas pelo produtor. Hash e QR não comprovam legalidade nem substituem
          licenças ou certificações.
        </p>
        <a href="/">Abrir área do produtor</a>
      </section>
    </main>
  );
}
