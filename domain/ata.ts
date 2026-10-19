// Montagem de atas de assembleia — ver docs/ESPECIFICACAO-V2.md.
// Puxa automaticamente do cadastro do condomínio e do edital emitido; o "miolo" da reunião
// (presença, mesa, discussão e deliberação por item) é digitado pelo usuário.
import type { Ata, Assembleia, Condominio } from './types';

export function novaAtaApartirDoEdital(_assembleia: Assembleia, _condominio: Condominio): Ata {
  throw new Error('não implementado');
}
