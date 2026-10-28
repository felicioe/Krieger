/**
 * Adaptador MOCK da API — usado apenas no preview/localhost.
 * Guarda tudo no localStorage e imita as regras e mensagens da API PHP.
 * Usuário semente: admin / admin123 (perfil admin).
 */
import { STORES, type Assembleia, type Backup, type BackupRegistro, type Condominio, type ConsultaHistoricoItem, type Importacao, type Mensal, type Store, type Usuario, type UsuarioAdmin } from "@/domain/types";
import { condominioPadrao, normalizarCondominio } from "@/domain/condominio";
import { exercicioPadrao } from "@/domain/exercicio";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import { validarLogin, validarNovaSenha } from "@/domain/usuario";
import { novaAtaDeAssembleia } from "@/domain/ata";
import { normalizarAssembleia } from "@/domain/edital";
import { dataParaBR, dataParaISO } from "./format";
import { novoId } from "./id";
import { ApiError, type ApiAdapter, type ConfirmarImportacaoResposta, type Registro } from "./apiTypes";

const CHAVE_DADOS = "krieger-mock-dados-v1";
const CHAVE_USUARIOS = "krieger-mock-usuarios-v1";
const CHAVE_SESSAO = "krieger-mock-sessao-v1";
const CHAVE_TENTATIVAS = "krieger-mock-tentativas-v1";
const CHAVE_EXEMPLO_EXERCICIO = "krieger-mock-exemplo-exercicio-v1";
const CHAVE_EXEMPLO_MENSAIS = "krieger-mock-exemplo-mensais-v2";
const CHAVE_EXEMPLO_EDITAIS = "krieger-mock-exemplo-editais-v1";
const CHAVE_EXEMPLO_ATAS = "krieger-mock-exemplo-atas-v1";
const CHAVE_EXEMPLO_MODELO_V2 = "krieger-mock-exemplo-modelo-v2";
const CHAVE_BACKUPS = "krieger-mock-backups-v1";
const CHAVE_CONSULTA_HISTORICO = "krieger-mock-consulta-historico-v1";
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MIN = 15;

type Dados = Record<Store, Registro[]>;
type UsuarioMock = UsuarioAdmin & { senha: string };

const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function emDias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function semente(): Dados {
  const ano = new Date().getFullYear();
  const mesAno = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const base = condominioPadrao();
  const condominios: Registro[] = [
    {
      ...base,
      id: "condo-acacias",
      codigo: "001",
      nome: "Condomínio Residencial Jardim das Acácias",
      nomeRelatorio: "Residencial Jardim das Acácias",
      cnpj: "12.345.678/0001-90",
      unidades: 48,
      rateioAtual: 650,
      quorum: "maioria simples dos presentes",
      administracao: [
        { cargo: "Síndico", nome: "Carlos Mendes", mandatoFim: mesAno(emDias(60)) },
        { cargo: "Subsíndica", nome: "Ana Souza", mandatoFim: mesAno(emDias(60)) },
      ],
      seguradora: "Porto Seguro",
      vigenciaSeguro: dataParaBR(emDias(45)),
      seguro: {
        riscoAbsoluto: 8500000,
        coberturas: [
          { desc: "Incêndio, raio e explosão", valor: 8500000 },
          { desc: "Responsabilidade civil do síndico", valor: 200000 },
        ],
      },
      vigenciaExtintores: dataParaBR(emDias(20)),
      vistoriaAno: ano - 3,
      vistoriaIntervalo: 3,
      variacaoPadrao: 5,
      indices: [
        { ano: ano - 3, pct: 4.62 },
        { ano: ano - 2, pct: 4.83 },
        { ano: ano - 1, pct: 4.5 },
      ],
    },
    {
      ...base,
      id: "condo-solar",
      codigo: "002",
      nome: "Edifício Solar do Vale",
      cnpj: "98.765.432/0001-10",
      unidades: 24,
      rateioAtual: 820.5,
      administracao: [{ cargo: "Síndica", nome: "Beatriz Lima", mandatoFim: `12/${ano + 1}` }],
      seguradora: "Tokio Marine",
      vigenciaSeguro: dataParaBR(emDias(200)),
      vigenciaExtintores: dataParaBR(emDias(-10)),
      vistoriaAno: ano - 1,
    },
    {
      ...base,
      id: "condo-pinheiros",
      codigo: "003",
      nome: "Condomínio Portal dos Pinheiros",
      cnpj: "45.678.912/0001-33",
      unidades: 120,
      rateioAtual: 480,
      administracao: [{ cargo: "Síndico", nome: "Roberto Alves", mandatoFim: `06/${ano + 1}` }],
      seguradora: "Allianz",
      vigenciaSeguro: dataParaBR(emDias(300)),
      vigenciaExtintores: dataParaBR(emDias(250)),
      vistoriaAno: ano,
    },
  ];
  const assembleiaBase = {
    modeloId: "",
    modalidade: "presencial",
    hora2: "",
    quorum: "",
    local: "Salão de festas",
    zoomLink: "",
    zoomId: "",
    zoomSenha: "",
    pauta: [],
    exercicio: String(ano - 1),
    entregaContas: "email",
    dataEmissao: "",
    cidade: "",
    assinante: "",
    cargo: "",
    timbrado: true,
    linhasLista: 30,
  };
  const assembleias: Registro[] = [
    { ...assembleiaBase, ...editalExemplo(), id: "ass-1", condoId: "condo-acacias", tipo: "ordinaria", data: dataParaISO(emDias(12)) },
    { ...assembleiaBase, id: "ass-2", condoId: "condo-solar", tipo: "extraordinaria", modalidade: "online", data: dataParaISO(emDias(30)), hora1: "20:00" },
    { ...assembleiaBase, id: "ass-3", condoId: "condo-pinheiros", tipo: "ordinaria", data: dataParaISO(emDias(-40)), hora1: "19:30" },
  ];
  return {
    condominios,
    exercicios: [exercicioExemplo(condominios[0] as Registro)],
    mensais: mensaisExemplo(condominios[0] as Registro),
    assembleias,
    modelos: [modeloExemplo()],
    config: [{ id: "escritorio", nome: "Krieger Assessoria Contábil e Condominial", cidade: "", rodape: "", assinatura: "", logo: "", logoRatio: null }],
    importacoes: [],
    anexos_importacao: [],
    atas: [ataExemplo(assembleias[0] as Registro, condominios[0] as Registro)],
    decisoes_previsao: [],
  };
}

/** Modelo de edital de exemplo, com variáveis {{...}} e condições no formato de `domain/modeloTexto.ts`. */
function modeloExemplo(): Registro {
  return { id: "mod-padrao", nome: "Edital padrão", versao: 2, pautaOrdinaria: PAUTA_EXEMPLO, blocos: blocosExemplo() };
}

const PAUTA_EXEMPLO = [
  "Prestação de contas do exercício anterior;",
  "Previsão orçamentária para o próximo exercício;",
  "Eleição de síndico, subsíndico e conselho fiscal;",
  "Assuntos gerais.",
];

function blocosExemplo() {
  const b = (id: string, tipo: string, texto: string, cond = "") => ({ id, tipo, texto, cond });
  return [
    b("b1", "titulo", "EDITAL DE CONVOCAÇÃO"),
    b("b2", "subtitulo", "ASSEMBLEIA GERAL ORDINÁRIA", 'assembleia.tipo == "ordinaria"'),
    b("b2x", "subtitulo", "ASSEMBLEIA GERAL EXTRAORDINÁRIA", 'assembleia.tipo == "extraordinaria"'),
    b(
      "b3",
      "texto",
      "Ficam convocados os senhores condôminos do {{condominio.nomeRelatorio}} a se reunirem em Assembleia Geral, no dia {{assembleia.data}}, às {{assembleia.hora1}} em primeira convocação, com {{assembleia.quorum}}, ou às {{assembleia.hora2}} em segunda convocação, com qualquer número de presentes, para deliberarem sobre a seguinte ordem do dia:",
    ),
    b("b4", "pauta", ""),
    b("b5", "texto", "Local: {{assembleia.local}}.", 'assembleia.modalidade != "online"'),
    b("b6", "texto", "Acesso pelo Zoom: {{assembleia.zoomLink}} — ID {{assembleia.zoomId}} — senha {{assembleia.zoomSenha}}.", 'assembleia.modalidade != "presencial"'),
    b("b7", "item", "A prestação de contas do exercício de {{assembleia.exercicio}} será enviada por e-mail.", 'assembleia.entregaContas == "email"'),
    b("b7a", "item", "A prestação de contas do exercício de {{assembleia.exercicio}} ficará à disposição na administração.", 'assembleia.entregaContas == "administracao"'),
    b("b7b", "item", "A prestação de contas do exercício de {{assembleia.exercicio}} estará disponível no aplicativo.", 'assembleia.entregaContas == "aplicativo"'),
    b("b8", "item", "Os condôminos poderão ser representados por procurador, mediante procuração por escrito."),
    b("b9", "esquerda", "{{assembleia.cidade}}, {{assembleia.dataEmissao}}."),
    b("b10", "esquerda", "{{assembleia.assinante}}\n{{assembleia.cargo}}"),
  ];
}

/** Campos do edital de exemplo (assembleia ordinária do Jardim das Acácias). */
function editalExemplo(): Record<string, unknown> {
  return {
    modeloId: "mod-padrao",
    modalidade: "hibrida",
    hora1: "19:00",
    hora2: "19:30",
    quorum: "maioria simples dos presentes",
    local: "Salão de festas do condomínio",
    zoomLink: "https://zoom.us/j/81234567890",
    zoomId: "812 3456 7890",
    zoomSenha: "acacias",
    pauta: [...PAUTA_EXEMPLO],
    exercicio: String(new Date().getFullYear() - 1),
    cidade: "Curitiba",
    entregaContas: "email",
    dataEmissao: dataParaBR(new Date()),
    assinante: "Carlos Mendes",
    cargo: "Síndico",
    timbrado: true,
    linhasLista: 48,
  };
}

/** Ata de exemplo (rascunho) ligada ao edital do Jardim das Acácias, parcialmente preenchida. */
function ataExemplo(edital: Registro, condo: Registro): Registro {
  const base = novaAtaDeAssembleia(
    normalizarAssembleia(edital as Partial<Assembleia> & { id: string }),
    normalizarCondominio(condo as Partial<Condominio> & { id: string }),
  );
  const [primeiro, segundo, ...resto] = base.itens;
  return {
    ...base,
    id: "ata-acacias",
    mesa: { presidente: "Ana Souza", secretario: "Paulo Ribeiro" },
    presentes: [
      { unidade: "101", nome: "Ana Souza", procurador: false },
      { unidade: "102", nome: "Paulo Ribeiro", procurador: false },
      { unidade: "203", nome: "Márcia Oliveira", procurador: true },
      { unidade: "304", nome: "Carlos Mendes", procurador: false },
      { unidade: "402", nome: "Fernanda Costa", procurador: false },
    ],
    quorum: { ...base.quorum, unidadesPresentes: 5 },
    itens: [
      ...(primeiro
        ? [{ ...primeiro, discussao: "Apresentado o demonstrativo do exercício; dúvidas sobre a conta de água esclarecidas.", deliberacao: "Contas aprovadas.", votos: { favor: 4, contra: 0, abstencao: 1 } }]
        : []),
      ...(segundo ? [{ ...segundo, discussao: "Apresentada a previsão orçamentária com os ajustes propostos." }] : []),
      ...resto,
    ],
  };
}

/** Prestação de contas de exemplo (ano anterior) do primeiro condomínio. */
function exercicioExemplo(condo: Registro): Registro {
  const ano = new Date().getFullYear() - 1;
  const c = normalizarCondominio(condo);
  const e = exercicioPadrao(c, ano, "Curitiba");
  const l = (nome: string, valor: number) => ({ nome, valor });
  const demonstrativo = recalcularDemonstrativo({
    ...e.demonstrativo!,
    periodo: { ini: `01/01/${ano}`, fim: `31/12/${ano}` },
    saldoAnterior: { contas: [l("Conta corrente", 12300.5), l("Aplicação financeira", 45000)], total: 0 },
    receitas: {
      itens: [l("Taxa condominial", 374400), l("Fundo de reserva", 37440), l("Multas e juros", 2150.3), l("Rendimentos de aplicação", 3820.15)],
      subtotal: 0,
      totalComSaldo: 0,
    },
    despesas: {
      grupos: [
        { nome: "Pessoal", itens: [l("Salários", 132000), l("Encargos sociais", 52800), l("Vale-transporte", 9600)] },
        { nome: "Consumo", itens: [l("Água e esgoto", 54300), l("Energia elétrica", 31200)] },
        {
          nome: "Manutenção",
          itens: [l("Manutenção de elevadores", 14400), l("Jardinagem", 9000), l("Fundo de caixa p/ obras", 24000), l("Manutenção predial", 18750.4)],
        },
        { nome: "Administrativas", itens: [l("Taxa de administração", 21600), l("Seguro predial", 6850), l("Material de escritório", 1240.6)] },
      ],
      subtotal: 0,
      saldoRestante: 0,
    },
    saldoAtual: { contas: [l("Conta corrente", 14369.95), l("Aplicação financeira", 85000)], total: 0 },
  });
  return {
    ...e,
    id: "exe-acacias-" + ano,
    demonstrativo,
    variacao: 5,
    prev: {
      modo: "tradicional",
      fundoReservaPct: 10,
      ajustes: [
        { id: "aj-1", descricao: "Pintura da fachada (rateio em 12 meses)", sinal: "+", valor: 18000, grupo: "Manutenção" },
        { id: "aj-2", descricao: "Fim do contrato de vigilância noturna", sinal: "-", valor: 6000, grupo: "Pessoal" },
      ],
    },
  } as unknown as Registro;
}

/** Relatórios mensais de exemplo do ano corrente (exercício seguinte ao exemplo). */
function mensaisExemplo(condo: Registro): Registro[] {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const ate = Math.max(1, hoje.getMonth()); // meses já fechados
  const nome = normalizarCondominio(condo).nomeRelatorio || String(condo["nome"] ?? "");
  const l = (n: string, valor: number) => ({ nome: n, valor: Math.round(valor * 100) / 100 });
  const ultimoDia = (m: number) => new Date(ano, m, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  // Saldo inicial = saldo atual do exercício de exemplo (31/12 do ano anterior).
  let contas = [l("Conta corrente", 14369.95), l("Aplicação financeira", 85000)];
  const notasPorMes: Record<number, { rubrica: string; texto: string; valor: number | null }[]> = {
    3: [{ rubrica: "Pintura da fachada (rateio em 12 meses)", texto: "Início da pintura da fachada, aprovada em assembleia; 1ª de 6 parcelas.", valor: 3000 }],
    5: [{ rubrica: "Energia elétrica", texto: "Reajuste tarifário da concessionária aplicado a partir deste mês.", valor: null }],
  };
  return Array.from({ length: ate }, (_, i) => {
    const m = i + 1;
    const osc = 1 + ((m * 7) % 5) / 100 - 0.02; // pequena oscilação mês a mês
    const base = recalcularDemonstrativo({
      ...demonstrativoVazio(nome),
      periodo: { ini: `01/${p(m)}/${ano}`, fim: `${ultimoDia(m)}/${p(m)}/${ano}` },
      saldoAnterior: { contas: contas.map((c) => ({ ...c })), total: 0 },
      receitas: {
        itens: [l("Taxa condominial", 31200 * 1.1 - 715 * (3 + (m % 3))), l("Fundo de reserva", 3120), l("Rendimentos de aplicação", 410 + m * 12.5)],
        subtotal: 0,
        totalComSaldo: 0,
      },
      despesas: {
        grupos: [
          { nome: "Pessoal", itens: [l("Salários", 11550), l("Encargos sociais", 4620), l("Vale-transporte", 840 * osc)] },
          { nome: "Consumo", itens: [l("Água e esgoto", 4751 * osc), l("Energia elétrica", 2730 * 1.18 * osc)] },
          {
            nome: "Manutenção",
            itens: [
              l("Manutenção de elevadores", 1260),
              l("Jardinagem", 600),
              l("Fundo de caixa p/ obras", 2000),
              l("Manutenção predial", 1640 * osc),
              ...(m >= 3 && m <= 8 ? [l("Pintura da fachada (rateio em 12 meses)", 3000)] : []),
            ],
          },
          { nome: "Administrativas", itens: [l("Taxa de administração", 1890), l("Seguro predial", 599), l("Material de escritório", 108.55 * osc)] },
        ],
        subtotal: 0,
        saldoRestante: 0,
      },
    });
    // Saldo atual fecha com o calculado: aplicação cresce, o resto fica na conta corrente.
    const aplicacao = 85000 + 1500 * m;
    contas = [l("Conta corrente", base.despesas.saldoRestante - aplicacao), l("Aplicação financeira", aplicacao)];
    const demonstrativo = recalcularDemonstrativo({ ...base, saldoAtual: { contas, total: 0 } });
    const inadimplentes = 3 + (m % 3);
    return {
      id: `men-acacias-${ano}${p(m)}`,
      condoId: condo.id,
      condoNome: nome,
      demonstrativo,
      origem: [],
      receber: { unidades: inadimplentes, valor: Math.round(inadimplentes * 715 * (1 + (m % 2) * 0.6) * 100) / 100 },
      notas: notasPorMes[m] ?? [],
    } as unknown as Registro;
  });
}

function usuariosSemente(): UsuarioMock[] {
  return [
    {
      id: "u-admin",
      login: "admin",
      nome: "Administrador",
      perfil: "admin",
      ativo: true,
      trocarSenha: false,
      criadoEm: new Date().toISOString(),
      ultimoAcesso: null,
      senha: "admin123",
    },
  ];
}

function ler<T>(chave: string, inicial: () => T): T {
  const bruto = localStorage.getItem(chave);
  if (bruto) {
    try {
      return JSON.parse(bruto) as T;
    } catch {
      /* recria abaixo */
    }
  }
  const v = inicial();
  localStorage.setItem(chave, JSON.stringify(v));
  return v;
}
const gravar = (chave: string, v: unknown) => localStorage.setItem(chave, JSON.stringify(v));

function dados(): Dados {
  const d = ler<Dados>(CHAVE_DADOS, semente);
  for (const s of STORES) if (!Array.isArray(d[s])) d[s] = [];
  // Quem já usava o preview antes desta entrega também recebe o exemplo (uma vez).
  if (!localStorage.getItem(CHAVE_EXEMPLO_EXERCICIO)) {
    localStorage.setItem(CHAVE_EXEMPLO_EXERCICIO, "1");
    const condo = d.condominios.find((c) => c.id === "condo-acacias");
    if (condo && d.exercicios.length === 0) {
      d.exercicios.push(exercicioExemplo(condo));
      gravar(CHAVE_DADOS, d);
    }
  }
  if (!localStorage.getItem(CHAVE_EXEMPLO_MENSAIS)) {
    localStorage.setItem(CHAVE_EXEMPLO_MENSAIS, "1");
    const condo = d.condominios.find((c) => c.id === "condo-acacias");
    if (condo) {
      // Substitui os exemplos antigos (sem saldos) que não foram editados; não mexe no que o usuário criou.
      for (const novo of mensaisExemplo(condo)) {
        const i = d.mensais.findIndex((m) => m.id === novo.id);
        const antigo = i >= 0 ? (d.mensais[i] as unknown as Mensal) : null;
        if (antigo && (antigo.demonstrativo?.saldoAnterior?.contas?.length ?? 0) === 0 && (antigo.notas?.length ?? 0) === 0) {
          d.mensais[i] = novo;
        } else if (!antigo && !d.mensais.some((m) => m["condoId"] === "condo-acacias" && JSON.stringify((m as unknown as Mensal).demonstrativo?.periodo) === JSON.stringify((novo as unknown as Mensal).demonstrativo?.periodo))) {
          d.mensais.push(novo);
        }
      }
      gravar(CHAVE_DADOS, d);
    }
  }
  if (!localStorage.getItem(CHAVE_EXEMPLO_EDITAIS)) {
    localStorage.setItem(CHAVE_EXEMPLO_EDITAIS, "1");
    if (!d.modelos.some((m) => m.id === "mod-padrao")) d.modelos.push(modeloExemplo());
    // Completa o edital semente antigo (sem modelo e sem pauta); não mexe em editais editados.
    const i = d.assembleias.findIndex((a) => a.id === "ass-1");
    const antigo = i >= 0 ? (d.assembleias[i] as Registro) : null;
    if (antigo && !antigo["modeloId"] && !(antigo["pauta"] as unknown[] | undefined)?.length) {
      d.assembleias[i] = { ...antigo, ...editalExemplo(), id: "ass-1" };
    }
    gravar(CHAVE_DADOS, d);
  }
  if (!localStorage.getItem(CHAVE_EXEMPLO_ATAS)) {
    localStorage.setItem(CHAVE_EXEMPLO_ATAS, "1");
    const edital = d.assembleias.find((a) => a.id === "ass-1");
    const condo = d.condominios.find((c) => c.id === "condo-acacias");
    if (edital && condo && !d.atas.some((a) => a.id === "ata-acacias" || a["assembleiaId"] === "ass-1")) {
      d.atas.push(ataExemplo(edital, condo));
      gravar(CHAVE_DADOS, d);
    }
  }
  if (!localStorage.getItem(CHAVE_EXEMPLO_MODELO_V2)) {
    localStorage.setItem(CHAVE_EXEMPLO_MODELO_V2, "1");
    // O modelo de exemplo antigo usava marcadores {campo} sem lógica: troca pelos {{...}} com condições, se não foi editado.
    const i = d.modelos.findIndex((m) => m.id === "mod-padrao");
    const antigo = i >= 0 ? (d.modelos[i] as Registro) : null;
    if (antigo && JSON.stringify(antigo["blocos"] ?? []).includes("ASSEMBLEIA GERAL {tipo}")) {
      d.modelos[i] = { ...antigo, versao: 2, blocos: blocosExemplo() };
      gravar(CHAVE_DADOS, d);
    }
  }
  return d;
}
const usuarios = () => ler<UsuarioMock[]>(CHAVE_USUARIOS, usuariosSemente);
type BackupRegistroMock = BackupRegistro & { dados: Backup };
const backups = () => ler<BackupRegistroMock[]>(CHAVE_BACKUPS, () => []);
type ConsultaHistoricoMock = ConsultaHistoricoItem & { condoId: string };
const consultaHistorico = () => ler<ConsultaHistoricoMock[]>(CHAVE_CONSULTA_HISTORICO, () => []);
const semDados = ({ dados: _dados, ...r }: BackupRegistroMock): BackupRegistro => r;

function publico(u: UsuarioMock): UsuarioAdmin {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { senha, ...resto } = u;
  return resto;
}
function sessao(): Usuario {
  const id = localStorage.getItem(CHAVE_SESSAO);
  const u = id ? usuarios().find((x) => x.id === id && x.ativo) : undefined;
  if (!u) throw new ApiError("Sessão expirada. Entre novamente.", 401);
  const { id: uid, login, nome, perfil, trocarSenha } = u;
  return { id: uid, login, nome, perfil, trocarSenha };
}
function exigirAdmin() {
  const u = sessao();
  if (u.perfil !== "admin") throw new ApiError("Acesso restrito a administradores.", 403);
  return u;
}
function validarStore(s: string): Store {
  if (!STORES.includes(s as Store)) throw new ApiError(`Store inválida: ${s}`, 400);
  return s as Store;
}

export const mockApi: ApiAdapter = {
  async listar<T>(store: Store) {
    await espera();
    sessao();
    return clone(dados()[validarStore(store)]) as T[];
  },
  async obter<T>(store: Store, id: string) {
    await espera();
    sessao();
    const r = dados()[validarStore(store)].find((x) => x.id === id);
    return r ? (clone(r) as T) : null;
  },
  async salvar<T extends { id?: string }>(store: Store, o: T) {
    await espera();
    sessao();
    const d = dados();
    const s = validarStore(store);
    const id = (o.id || novoId()).slice(0, 64);
    const obj = { ...clone(o), id } as unknown as Registro;
    const i = d[s].findIndex((x) => x.id === id);
    if (i >= 0) d[s][i] = obj;
    else d[s].push(obj);
    gravar(CHAVE_DADOS, d);
    return clone(obj) as unknown as T & { id: string };
  },
  async excluir(store: Store, id: string) {
    await espera();
    sessao();
    const d = dados();
    const s = validarStore(store);
    d[s] = d[s].filter((x) => x.id !== id);
    gravar(CHAVE_DADOS, d);
  },
  async exportar() {
    await espera();
    sessao();
    return { ...clone(dados()), _exportadoEm: new Date().toISOString(), _versao: 1 } as Backup;
  },
  /** Imita o endpoint atômico: valida tudo, depois grava condomínio, registro e importação de uma vez. */
  async confirmarImportacao(pedido) {
    await espera();
    sessao();
    const d = dados();
    const i = d.importacoes.findIndex((x) => x.id === pedido.importacaoId);
    if (i < 0) throw new ApiError("Importação não encontrada.", 404);
    const imp = d.importacoes[i] as unknown as Importacao;
    const destino = pedido.destino;
    if (destino !== "mensais" && destino !== "exercicios") throw new ApiError("Destino da importação inválido.", 400);
    if (imp.status === "confirmado") {
      const ja = imp.registroId ? d[destino].find((x) => x.id === imp.registroId) : undefined;
      if (!ja) throw new ApiError("Esta importação já foi confirmada, mas o registro gravado não foi encontrado.", 409);
      return clone({ registro: ja, condominioId: imp.condominioId ?? "", criouCondominio: false, reutilizado: true }) as unknown as ConfirmarImportacaoResposta;
    }
    if (imp.status !== "pendente") throw new ApiError("Esta importação foi descartada e não pode ser confirmada.", 409);
    const condoId = pedido.condominio?.id;
    const registro = pedido.registro as unknown as Registro;
    if (!condoId || !registro?.id) throw new ApiError("Dados incompletos para confirmar a importação.", 400);
    if (registro["condoId"] !== condoId) throw new ApiError("O registro não pertence ao condomínio informado.", 400);
    if (d[destino].some((x) => x.id === registro.id)) throw new ApiError("Já existe um registro com este identificador.", 409);
    const existe = d.condominios.some((c) => c.id === condoId);
    if (!existe && !("nome" in pedido.condominio)) throw new ApiError("Condomínio não encontrado.", 404);
    // Tudo validado: uma única gravação (não sobra condomínio sem relatório nem importação pendente).
    if (!existe) d.condominios.push(clone(pedido.condominio) as unknown as Registro);
    d[destino].push(clone(registro));
    d.importacoes[i] = {
      ...imp,
      status: "confirmado",
      cadastro: { ...imp.cadastro, ...pedido.cadastro, revisar: false },
      condominioId: condoId,
      registroId: registro.id,
    } as unknown as Registro;
    gravar(CHAVE_DADOS, d);
    return clone({ registro, condominioId: condoId, criouCondominio: !existe, reutilizado: false }) as unknown as ConfirmarImportacaoResposta;
  },
  async importar(backup: Backup, substituir: boolean) {
    await espera(300);
    exigirAdmin();
    if (!backup || typeof backup !== "object") throw new ApiError("Arquivo de backup inválido.", 400);
    const d = dados();
    let total = 0;
    for (const s of STORES) {
      const itens = backup[s];
      if (!Array.isArray(itens)) {
        if (substituir) d[s] = [];
        continue;
      }
      const validos = itens.filter((x): x is Registro => !!x && typeof x === "object" && typeof (x as Registro).id === "string");
      total += validos.length;
      if (substituir) d[s] = clone(validos);
      else {
        for (const item of validos) {
          const i = d[s].findIndex((x) => x.id === item.id);
          if (i >= 0) d[s][i] = clone(item);
          else d[s].push(clone(item));
        }
      }
    }
    gravar(CHAVE_DADOS, d);
    return { ok: true, total };
  },
  backup: {
    async criar() {
      await espera(200);
      const eu = sessao();
      const dadosAtuais = { ...clone(dados()), _exportadoEm: new Date().toISOString(), _versao: 1 } as Backup;
      const reg: BackupRegistroMock = {
        id: novoId(),
        geradoPorNome: eu.nome,
        criadoEm: new Date().toISOString(),
        tamanhoBytes: new Blob([JSON.stringify(dadosAtuais)]).size,
        dados: dadosAtuais,
      };
      const lista = backups();
      lista.unshift(reg);
      gravar(CHAVE_BACKUPS, lista);
      return semDados(reg);
    },
    async listar() {
      await espera();
      sessao();
      return backups().map(semDados);
    },
    async baixar(id: string) {
      await espera();
      sessao();
      const r = backups().find((x) => x.id === id);
      if (!r) throw new ApiError("Backup não encontrado.", 404);
      return clone(r.dados);
    },
    async restaurar(id: string, substituir: boolean) {
      await espera(300);
      exigirAdmin();
      const r = backups().find((x) => x.id === id);
      if (!r) throw new ApiError("Backup não encontrado.", 404);
      return mockApi.importar(r.dados, substituir);
    },
    async excluir(id: string) {
      await espera();
      exigirAdmin();
      gravar(
        CHAVE_BACKUPS,
        backups().filter((x) => x.id !== id),
      );
    },
  },
  auth: {
    async eu() {
      await espera(60);
      try {
        return sessao();
      } catch {
        return null;
      }
    },
    async entrar(login: string, senha: string) {
      await espera(250);
      const tent = ler<Record<string, { n: number; ate?: number }>>(CHAVE_TENTATIVAS, () => ({}));
      const chave = (login || "").toLowerCase().trim();
      const t = tent[chave];
      if (t?.ate && t.ate > Date.now()) {
        const min = Math.ceil((t.ate - Date.now()) / 60000);
        throw new ApiError(`Muitas tentativas sem sucesso. Acesso bloqueado por ${min} minuto(s).`, 429);
      }
      const lista = usuarios();
      const u = lista.find((x) => x.login === chave);
      if (!u || u.senha !== senha) {
        const n = (t && (!t.ate || t.ate <= Date.now()) ? t.n : 0) + 1;
        tent[chave] = n >= MAX_TENTATIVAS ? { n: 0, ate: Date.now() + BLOQUEIO_MIN * 60000 } : { n };
        gravar(CHAVE_TENTATIVAS, tent);
        if (n >= MAX_TENTATIVAS) {
          throw new ApiError(`Muitas tentativas sem sucesso. Acesso bloqueado por ${BLOQUEIO_MIN} minutos.`, 429);
        }
        throw new ApiError(`Usuário ou senha incorretos. Restam ${MAX_TENTATIVAS - n} tentativa(s).`, 401);
      }
      if (!u.ativo) throw new ApiError("Usuário inativo. Procure o administrador.", 403);
      delete tent[chave];
      gravar(CHAVE_TENTATIVAS, tent);
      u.ultimoAcesso = new Date().toISOString();
      gravar(CHAVE_USUARIOS, lista);
      localStorage.setItem(CHAVE_SESSAO, u.id);
      return sessao();
    },
    async sair() {
      await espera(60);
      localStorage.removeItem(CHAVE_SESSAO);
    },
    async minhaSenha(atual: string, nova: string) {
      await espera();
      const eu = sessao();
      const lista = usuarios();
      const u = lista.find((x) => x.id === eu.id)!;
      if (u.senha !== atual) throw new ApiError("A senha atual está incorreta.", 400);
      const erro = validarNovaSenha(nova);
      if (erro) throw new ApiError(erro, 400);
      if (nova === atual) throw new ApiError("A nova senha deve ser diferente da atual.", 400);
      u.senha = nova;
      u.trocarSenha = false;
      gravar(CHAVE_USUARIOS, lista);
    },
    async usuarios() {
      await espera();
      exigirAdmin();
      return usuarios().map(publico);
    },
    async usuarioSalvar(dadosU) {
      await espera();
      const eu = exigirAdmin();
      const lista = usuarios();
      const nome = (dadosU.nome || "").trim();
      if (!nome) throw new ApiError("Informe o nome.", 400);
      if (dadosU.senha) {
        const e = validarNovaSenha(dadosU.senha);
        if (e) throw new ApiError(e.replace("nova senha", "senha"), 400);
      }
      if (!dadosU.id) {
        const login = (dadosU.login || "").trim();
        const e = validarLogin(login);
        if (e) throw new ApiError(e, 400);
        if (lista.some((x) => x.login === login)) throw new ApiError("Já existe um usuário com este login.", 409);
        if (!dadosU.senha) throw new ApiError("Informe a senha provisória.", 400);
        const novo: UsuarioMock = {
          id: novoId(),
          login,
          nome,
          perfil: dadosU.perfil,
          ativo: dadosU.ativo,
          trocarSenha: true,
          criadoEm: new Date().toISOString(),
          ultimoAcesso: null,
          senha: dadosU.senha,
        };
        lista.push(novo);
        gravar(CHAVE_USUARIOS, lista);
        return publico(novo);
      }
      const u = lista.find((x) => x.id === dadosU.id);
      if (!u) throw new ApiError("Usuário não encontrado.", 404);
      const admins = lista.filter((x) => x.perfil === "admin" && x.ativo);
      const deixaDeSerAdmin = u.perfil === "admin" && u.ativo && (dadosU.perfil !== "admin" || !dadosU.ativo);
      if (deixaDeSerAdmin && admins.length <= 1) {
        throw new ApiError("Não é possível remover o último administrador ativo.", 400);
      }
      if (u.id === eu.id && !dadosU.ativo) throw new ApiError("Você não pode desativar o seu próprio usuário.", 400);
      u.nome = nome;
      u.perfil = dadosU.perfil;
      u.ativo = dadosU.ativo;
      if (dadosU.senha) {
        u.senha = dadosU.senha;
        u.trocarSenha = u.id !== eu.id;
      }
      gravar(CHAVE_USUARIOS, lista);
      return publico(u);
    },
    async usuarioExcluir(id: string) {
      await espera();
      const eu = exigirAdmin();
      if (id === eu.id) throw new ApiError("Você não pode excluir o seu próprio usuário.", 400);
      const lista = usuarios();
      const u = lista.find((x) => x.id === id);
      if (!u) throw new ApiError("Usuário não encontrado.", 404);
      if (u.perfil === "admin" && lista.filter((x) => x.perfil === "admin").length <= 1) {
        throw new ApiError("Não é possível excluir o último administrador.", 400);
      }
      gravar(CHAVE_USUARIOS, lista.filter((x) => x.id !== id));
    },
  },
  documentos: {
    // Sem acervo indexado neste ambiente de demonstração — a busca real roda no servidor (FULLTEXT).
    async perguntar(condoId: string, pergunta: string) {
      await espera(300);
      const eu = sessao();
      const p = (pergunta || "").trim();
      if (!p) throw new ApiError("Digite uma pergunta.", 400);
      const historico = consultaHistorico();
      historico.unshift({
        id: novoId(),
        usuarioId: eu.id,
        condoId,
        pergunta: p,
        origem: "local",
        tokensEntrada: 0,
        tokensSaida: 0,
        custoEstimadoCentavos: 0,
        status: "sem_evidencia",
        criadoEm: new Date().toISOString(),
      });
      gravar(CHAVE_CONSULTA_HISTORICO, historico.slice(0, 200));
      return {
        texto:
          "Este é o ambiente de demonstração, sem documentos indexados. Configure a pasta de documentos no cadastro do condomínio e rode o agente de indexação para consultar de verdade.",
        fontes: [],
        semEvidencia: true,
        origem: "local",
      };
    },
    async historico(condoId: string) {
      await espera();
      sessao();
      return clone(consultaHistorico().filter((h) => h.condoId === condoId));
    },
  },
};
