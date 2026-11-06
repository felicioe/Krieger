import { describe, it, expect } from 'vitest';
import { exercicioPadrao, normalizarExercicio } from './exercicio';
import type { Condominio } from './types';

describe('Trava de exercício (fechado)', () => {
  const c = { id: 'test-condo', nome: 'Teste' } as Condominio;

  it('deve criar exercício com fechado=false por padrão', () => {
    const e = exercicioPadrao(c, 2026);
    expect(e.fechado).toBe(false);
  });

  it('deve manter o estado fechado ao normalizar', () => {
    const raw = { id: '1', condoId: 'c1', ano: 2026, fechado: true };
    const e = normalizarExercicio(raw as any);
    expect(e.fechado).toBe(true);
  });

  it('deve assumir false se o campo estiver ausente', () => {
    const raw = { id: '1', condoId: 'c1', ano: 2026 };
    const e = normalizarExercicio(raw as any);
    expect(e.fechado).toBe(false);
  });
});