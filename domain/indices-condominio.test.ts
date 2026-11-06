import { describe, it, expect } from 'vitest';
import type { IndiceAplicado } from './types';

describe('Histórico de Índices por Condomínio', () => {
 it('deve validar a estrutura do IndiceAplicado', () => {
 const indice: IndiceAplicado = {
 id: 'idx-1',
 condoId: 'condo-123',
 ano: 2026,
 indice: 5.5,
 tipo: 'IGP-M',
 mesReferencia: 1,
 dataAplicacao: '2026-01-01T00:00:00Z',
 };
 expect(indice.condoId).toBe('condo-123');
 expect(indice.indice).toBe(5.5);
 });

 it('deve permitir índices sem tipo ou mês (índices anuais manuais)', () => {
 const indice: IndiceAplicado = {
 id: 'idx-2',
 condoId: 'condo-456',
 ano: 2025,
 indice: 10.0,
 dataAplicacao: '2025-12-31T23:59:59Z',
 };
 expect(indice.tipo).toBeUndefined();
 expect(indice.mesReferencia).toBeUndefined();
 });
});