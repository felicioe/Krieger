import { substituirVariaveis, type ContextoBloco } from "./modeloTexto";

/**
 * Texto padrão da procuração para a assembleia, com variáveis {{condominio.*}} / {{assembleia.*}}
 * resolvidas da mesma forma que os blocos do modelo de edital (`domain/modeloTexto.ts`). Os campos
 * de preenchimento manual (outorgante, unidade, procurador) ficam em branco — o sistema não tem
 * cadastro de condôminos.
 */
export const TEXTO_PROCURACAO =
  "PROCURAÇÃO\n\n" +
  "Eu, _________________________________________________, portador(a) de direitos sobre a unidade " +
  "_______ do {{condominio.nome}}, inscrito no CNPJ {{condominio.cnpj}}, nomeio e constituo como " +
  "meu(minha) procurador(a) o(a) Sr(a). _________________________________________________, para que " +
  "me represente na Assembleia Geral {{assembleia.tipo}}, a realizar-se em {{assembleia.data}}, às " +
  "{{assembleia.hora1}}h, na modalidade {{assembleia.modalidade}}, com poderes para discutir e votar " +
  "as matérias constantes da convocação.\n\n" +
  "{{assembleia.cidade}}, {{assembleia.dataEmissao}}.\n\n\n" +
  "_________________________________________________\nAssinatura do outorgante";

/** Texto da procuração já com as variáveis do contexto (condomínio + assembleia) substituídas. */
export function montarProcuracao(contexto: ContextoBloco): string {
  return substituirVariaveis(TEXTO_PROCURACAO, contexto);
}
