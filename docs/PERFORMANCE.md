# Orçamento e medição de JavaScript

Issue #33. O CI limita a 250 KiB (256.000 bytes) a soma gzip da entrada
JavaScript e dos modulepreloads explicitamente declarados no HTML compilado.
O orçamento foi definido com folga sobre a referência de 22/10/2026:
159.605 bytes gzip local, 159.470 bytes de corpos HTTP reais em produção,
13 arquivos únicos. Referência: runtime index-DXQsfWcc.js, main 3dbeaad.
Revisar um aumento do limite em PR com justificativa, não para esconder falha.

Após compilar o frontend, executar `npm run bundle:check`. O comando falha
se não encontrar entradas, encontrar caminho inesperado, antecipar chunks
pesados de PDF/Word ou ultrapassar o orçamento. PDF e Word continuam carregados
por import dinâmico, quando solicitados. O script não modifica a interface.

Para medir os corpos HTTP reais na Hostinger:

```powershell
node scripts/check-bundle-budget.mjs --url=https://krieger.therafinancial.com.br/
```

A medição solicita gzip, conta os bytes recebidos de cada corpo e informa
gzip/identity conforme a resposta. Não inclui cabeçalhos, TLS, fontes, CSS,
worker PDF ou todos os imports de uma rota. Não é o total de uma sessão.
O gzip calculado localmente e a transferência HTTP são medidas diferentes.
Não comparar estes números com o monólito legado como se fossem o mesmo escopo.

Tamanho/HTTP não medem renderização, LCP, INP nem Core Web Vitals. Registrar
separadamente qualquer laboratório, sua rota, dados fictícios, engine, viewport,
CPU/rede e método. INP de campo exige observação de uso; não inventar nota a
partir de um build ou de uma resposta HTTP. Testes de fornecedor devem ser
identificados como tais, sem confundi-los com verificação independente.
