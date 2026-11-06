import { HttpError } from '../../../shared/errors/HttpError.js';
export function validateAnalysis(input = {}) {
  if (!['live', 'reference'].includes(input.mode))
    throw new HttpError(400, 'Escolha análise real ou dados de referência.');
  const yearBefore = Number(input.yearBefore ?? 2024),
    yearAfter = Number(input.yearAfter ?? 2025),
    radius = Number(input.radius ?? 1000);
  if (
    !Number.isInteger(yearBefore) ||
    !Number.isInteger(yearAfter) ||
    yearBefore < 2017 ||
    yearAfter > new Date().getFullYear() ||
    yearAfter <= yearBefore
  )
    throw new HttpError(400, 'Informe anos válidos, com ano final posterior ao inicial.');
  if (!Number.isInteger(radius) || radius < 100 || radius > 5000)
    throw new HttpError(400, 'O raio deve ter de 100 a 5000 metros.');
  const permissionId = input.permissionId ?? 'DEMO-AUT-001';
  if (typeof permissionId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(permissionId))
    throw new HttpError(400, 'Permissão demonstrativa inválida.');
  return {
    mode: input.mode,
    yearBefore,
    yearAfter,
    radius,
    permissionId,
    attemptId: input.attemptId || null,
  };
}
