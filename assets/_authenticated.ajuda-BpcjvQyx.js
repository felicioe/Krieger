import{i as e}from"./rolldown-runtime-COiEfhsA.js";import{n as t,t as n}from"./jsx-runtime-CldxteV5.js";import{t as r}from"./useSearch-9NaK07Qq.js";import{t as i}from"./button-pBidLpiN.js";import{a,o}from"./api-CUvdauIq.js";import{t as s}from"./search-Bjmx17AM.js";import{t as c}from"./x-BibQ4aST.js";import{t as l}from"./input-BFV07L3-.js";import{t as u}from"./PageHeader-B8g2ahsA.js";var d=e(t()),f=[{id:`visao-geral`,nome:`Visão geral`,descricao:`Como o Krieger se organiza e por onde começar.`,icone:`LayoutDashboard`},{id:`condominios`,nome:`Condomínios`,descricao:`Cadastro, condomínios recentes e exercícios.`,icone:`Building2`},{id:`prestacao-contas`,nome:`Prestação de contas`,descricao:`Demonstrativo, saldo e documentação do exercício.`,icone:`Receipt`},{id:`previsao`,nome:`Previsão orçamentária`,descricao:`Planejamento do ano seguinte e comparação com relatórios.`,icone:`Calculator`},{id:`relatorios`,nome:`Relatórios`,descricao:`Mensal, anual e comparativo orçado × realizado.`,icone:`FileSpreadsheet`},{id:`editais-atas`,nome:`Editais e atas`,descricao:`Convocação de assembleia, modelos e registro de deliberações.`,icone:`Megaphone`},{id:`documentos`,nome:`Documentos`,descricao:`Drive, importador e consulta de arquivos.`,icone:`FolderOpen`},{id:`importacao`,nome:`Importação`,descricao:`Importador de demonstrativos e prévia de importação.`,icone:`FileUp`},{id:`administracao`,nome:`Administração`,descricao:`Escritório, usuários, backup e preferências.`,icone:`Settings2`}],p=[{id:`visao-geral-inicio`,categoria:`visao-geral`,titulo:`Visão geral do Krieger`,resumo:`Como o Krieger se organiza e por onde começar a usar o sistema.`,palavrasChave:[`início`,`primeiros passos`,`dashboard`,`visão geral`],corpo:`# Visão geral do Krieger

O Krieger é um sistema de gestão condominial que centraliza prestação de contas, relatórios, editais, atas e documentos do seu condomínio em um só lugar.

## Por onde começar

1. Cadastre seu condomínio na seção de **Condomínios**.
2. Acesse o **dashboard** para ver o resumo do exercício em curso.
3. Explore os relatórios e a prestação de contas disponíveis.

Cada condomínio tem seus próprios exercícios, usuários e documentos, mantendo tudo organizado e separado por entidade.`},{id:`condominios-cadastro`,categoria:`condominios`,titulo:`Cadastro de condomínios`,resumo:`Como cadastrar, listar e gerenciar condomínios e exercícios no Krieger.`,palavrasChave:[`condomínio`,`cadastro`,`exercício`,`condomínios recentes`],corpo:`# Cadastro de condomínios

Na tela de **Condomínios** você cadastra novos condomínios e gerencia os já existentes.

## Passos

1. Vá ao menu **Condomínios**.
2. Clique em **Novo condomínio** e preencha os dados (nome, CNPJ, endereço, etc.).
3. Após salvar, crie o exercício vigente para começar a lançar movimentações.

Os condomínios recentes aparecem no topo da lista para acesso rápido.`},{id:`prestacao-contas`,categoria:`prestacao-contas`,titulo:`Prestação de contas`,resumo:`Demonstrativo, saldo e documentação do exercício.`,palavrasChave:[`prestação de contas`,`demonstrativo`,`saldo`,`documentação`],corpo:`# Prestação de contas

A prestação de contas reúne o demonstrativo financeiro, o saldo do exercício e a documentação de apoio.

## O que você encontra

- **Demonstrativo**: receitas, despesas e saldo apurado no período.
- **Saldo**: posição financeira atualizada do condomínio.
- **Documentação**: comprovantes e notas fiscais vinculados aos lançamentos.

Tudo pode ser filtrado por exercício e exportado em relatório.`},{id:`previsao-orcamentaria`,categoria:`previsao`,titulo:`Previsão orçamentária`,resumo:`Planejamento do ano seguinte e comparação com relatórios.`,palavrasChave:[`previsão`,`orçamento`,`orçamentária`,`planejamento`],corpo:`# Previsão orçamentária

Planeje o ano seguinte com base nos dados reais do exercício atual.

## Como funciona

1. Acesse **Previsão orçamentária** no menu.
2. Defina as receitas e despesas esperadas para o novo exercício.
3. Compare o orçado com o realizado usando os relatórios de comparação.

A comparação ajuda a identificar desvios e ajustar o planejamento ao longo do ano.`},{id:`editais-atas-guia`,categoria:`editais-atas`,titulo:`Editais e atas de assembleia`,resumo:`Convocação de assembleia, modelos e registro de deliberações.`,palavrasChave:[`edital`,`ata`,`assembleia`,`convocação`,`deliberação`],corpo:`# Editais e atas

Gerencie convocações de assembleia, modelos de documentos e o registro de deliberações.

## O que fazer

- **Edital de convocação**: modelo pronto para preenchimento com data, horário e pauta.
- **Ata de assembleia**: registre as decisões tomadas pelos condôminos.
- **Arquivamento**: todos os documentos ficam salvos por exercício para consulta futura.

Utilize os modelos disponíveis para garantir conformidade com a legislação condominial.`},{id:`documentos-drive`,categoria:`documentos`,titulo:`Drive e consulta de arquivos`,resumo:`Armazenamento, importador e consulta de arquivos do condomínio.`,palavrasChave:[`documentos`,`drive`,`arquivos`,`consulta`],corpo:`# Documentos

O módulo de Documentos concentra o drive, o importador e a consulta de arquivos do condomínio.

## Recursos

- **Drive**: envie, organize e baixe arquivos do condomínio por categoria.
- **Importador**: importe demonstrativos e outros documentos em lote.
- **Consulta**: busque arquivos por nome, data ou categoria.

A prévia de importação permite revisar os dados antes de confirmar a importação.`}],m=n();function h(){let{secao:e,artigo:t}=r({from:`/_authenticated/ajuda`}),[n,h]=(0,d.useState)(``),[g,_]=(0,d.useState)(t?p.find(e=>e.id===t)?.categoria??null:null);(0,d.useEffect)(()=>{if(!t)return;let e=window.setTimeout(()=>{o(t)},50);return()=>window.clearTimeout(e)},[t]),(0,d.useEffect)(()=>{if(!e)return;let t=window.setTimeout(()=>{o(e)},50);return()=>window.clearTimeout(t)},[e]);let v=p.filter(e=>{if(g&&e.categoria!==g)return!1;if(!n.trim())return!0;let t=n.toLowerCase();return e.titulo.toLowerCase().includes(t)||e.resumo.toLowerCase().includes(t)||e.palavrasChave.some(e=>e.toLowerCase().includes(t))});return(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(u,{titulo:`Central de Ajuda`,descricao:`Guias, tutoriais e respostas rápidas para usar o Krieger.`}),(0,m.jsxs)(`div`,{className:`mb-6 flex gap-2`,children:[(0,m.jsxs)(`div`,{className:`relative flex-1`,children:[(0,m.jsx)(s,{className:`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground`}),(0,m.jsx)(l,{type:`search`,placeholder:`Buscar por tópico, palavra-chave...`,value:n,onChange:e=>h(e.target.value),className:`pl-9`,"aria-label":`Buscar na Central de Ajuda`})]}),(0,m.jsx)(i,{variant:`ghost`,size:`icon`,onClick:()=>h(``),"aria-label":`Limpar busca`,children:(0,m.jsx)(c,{className:`size-4`})})]}),f.map(e=>{let t=v.filter(t=>t.categoria===e.id);if(t.length===0)return null;let n=g===e.id;return(0,m.jsxs)(`section`,{id:e.id,className:a(`mb-6 rounded-lg border bg-card p-4 transition-colors sm:p-5`,n&&`ring-2 ring-primary/40`),children:[(0,m.jsxs)(`div`,{className:`mb-3 flex items-center gap-2`,children:[e.icone,(0,m.jsxs)(`div`,{children:[(0,m.jsx)(`h2`,{className:`text-sm font-semibold text-foreground`,children:e.nome}),(0,m.jsx)(`p`,{className:`text-xs text-muted-foreground`,children:e.descricao})]})]}),(0,m.jsx)(`div`,{className:`space-y-4`,children:t.map(e=>(0,m.jsxs)(`div`,{id:e.id,className:`scroll-mt-24`,children:[(0,m.jsxs)(`div`,{className:`flex items-center justify-between gap-2`,children:[(0,m.jsx)(`h3`,{className:`text-sm font-medium text-foreground`,children:e.titulo}),(0,m.jsx)(i,{variant:`ghost`,size:`sm`,onClick:()=>{navigator.clipboard.writeText(`${window.location.origin}/ajuda?artigo=${e.id}`);let t=document.getElementById(e.id);t&&(t.setAttribute(`data-copiado`,`1`),setTimeout(()=>t.removeAttribute(`data-copiado`),1500))},"aria-label":`Copiar link para ${e.titulo}`,children:`🔗`})]}),(0,m.jsx)(`p`,{className:`text-sm text-muted-foreground`,children:e.resumo}),(0,m.jsx)(`p`,{className:`mt-2 text-sm text-foreground whitespace-pre-line`,children:e.corpo})]},e.id))})]},e.id)}),v.length===0&&(0,m.jsxs)(`p`,{className:`text-sm text-muted-foreground`,children:[`Nenhum artigo encontrado. Tente outros termos ou`,` `,(0,m.jsx)(i,{variant:`link`,size:`sm`,onClick:()=>{h(``),_(null)},children:`ver todos`}),`.`]})]})}export{h as component};