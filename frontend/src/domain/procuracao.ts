import { substituirVariaveis, type ContextoBloco } from "./modeloTexto";

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

export function montarProcuracao(contexto: ContextoBloco): string {
  return substituirVariaveis(TEXTO_PROCURACAO, contexto);
}
