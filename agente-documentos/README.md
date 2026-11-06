# Agente de indexação — Consulta Inteligente de Documentos

Varre a pasta de documentos de cada condomínio (no servidor de arquivos da empresa, NAS),
localiza convenção/regimento/atas pelo **nome do arquivo** e envia o conteúdo indexado para o
Krieger. Roda numa máquina com acesso ao NAS — nunca no Hostinger (o PHP de lá não permite
rodar processos externos).

Escopo deliberado: só convenção, regimento interno e atas de assembleia. O acervo financeiro
completo (balancetes, notas fiscais etc., > 160 GB) nunca é lido — a varredura olha só os nomes
dos arquivos antes de decidir o que abrir.

## Pré-requisitos

- Node.js 22 ou mais recente.
- Um usuário do Krieger com perfil **admin** dedicado ao agente (reaproveita o login normal do
  sistema — sem token/credencial nova nesta v1).
- Cada condomínio que deve ser indexado precisa ter o campo **Pasta de documentos** preenchido
  no cadastro (aponta pra raiz da pasta desse condomínio no NAS). Sem isso, o agente ignora o
  condomínio.

## Configuração

```sh
npm install
cp config.example.json config.local.json
```

Edite `config.local.json` (fica fora do Git) com a URL do Krieger e as credenciais do usuário
de serviço:

```json
{
  "apiBaseUrl": "https://SEU_DOMINIO/krieger",
  "login": "usuario_servico",
  "senha": "SENHA_DO_USUARIO_DE_SERVICO"
}
```

## Rodar

```sh
npm run indexar
```

Para cada condomínio com pasta cadastrada: varre os nomes de arquivo, calcula hash só dos que
batem com o padrão (convenção/regimento/ata), compara com o que já está indexado e só envia o
que é novo ou mudou. PDFs com camada de texto são lidos diretamente; PDFs digitalizados (sem
texto, ex.: documentos antigos só escaneados) passam por OCR automaticamente (mais lento).

O agente nunca move, renomeia ou apaga os PDFs originais — é só leitura.

## Agendamento

Este script não é um serviço contínuo — roda sob demanda. Para rodar periodicamente, agende
`npm run indexar` no Agendador de Tarefas do Windows (ou cron, se rodar em Linux/Mac) com a
frequência que fizer sentido (ex.: diária — convenção/regimento quase nunca mudam, atas só
depois de cada assembleia).

## Testes

```sh
npm test        # testes unitários (classificação de arquivo, chunking, diff de manifesto, hash)
npm run typecheck
```

Os testes unitários não dependem do NAS nem da rede — só a extração de texto/OCR (que precisa
de PDFs reais) e o indexador completo (que precisa da API e do NAS) exigem rodar de verdade.

## Limitações conhecidas desta v1

- Sem retomada de progresso: se o processo for interrompido no meio, os arquivos já enviados
  não são reenviados (o hash não mudou), mas o restante só é processado na próxima execução.
- OCR usa só português (`por`) como idioma.
