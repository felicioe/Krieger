<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

// Integração com a API da Anthropic (Claude) para a Consulta Inteligente de Documentos.
// Só é chamada quando a busca local (FULLTEXT) encontrou trechos mas a interpretação deles
// exige IA; nunca recebe o PDF inteiro, só os trechos já selecionados pela busca local.

const CLAUDE_MODELO = 'claude-haiku-5-5';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_API_VERSAO = '2026-10-21';
const CLAUDE_MAX_TOKENS_RESPOSTA = 1024;

// Preço do claude-haiku-5-5 (prompts de até 100 mil tokens): USD 0,10 / milhão de tokens de
// entrada, USD 0,50 / milhão de tokens de saída. Ajustar aqui se o modelo ou o preço mudar.
const CLAUDE_PRECO_ENTRADA_USD_POR_MTOK = 0.10;
const CLAUDE_PRECO_SAIDA_USD_POR_MTOK = 0.50;

/** Chave da API Anthropic, do mesmo arquivo de configuração usado pelo banco (nunca do frontend). */
function chave_claude(): ?string {
  try {
    $cfg = require caminho_config();
  } catch (Throwable $e) {
    return null;
  }
  $chave = $cfg['claude_api_key'] ?? null;
  return is_string($chave) && trim($chave) !== '' ? trim($chave) : null;
}

function custo_estimado_centavos(int $tokensEntrada, int $tokensSaida): int {
  $usd = ($tokensEntrada * CLAUDE_PRECO_ENTRADA_USD_POR_MTOK + $tokensSaida * CLAUDE_PRECO_SAIDA_USD_POR_MTOK) / 1_000_000;
  return (int) round($usd * 100);
}

/**
 * Monta o prompt só com os trechos relevantes (nunca o PDF inteiro) e pergunta ao Claude.
 * $trechos vem de buscar_trechos(): cada item tem nome_arquivo, tipo, pagina_inicial,
 * pagina_final, texto — tudo já filtrado pelo condomínio certo antes de chegar aqui.
 * Lança RuntimeException se a chamada falhar (quem chama decide como tratar).
 */
function chamar_claude_sobre_trechos(string $apiKey, string $pergunta, array $trechos): array {
  $evidencias = '';
  foreach ($trechos as $i => $t) {
    $evidencias .= sprintf(
      "[Fonte %d — %s (%s), página %d-%d]\n%s\n\n",
      $i + 1,
      $t['nome_arquivo'],
      $t['tipo'],
      (int) $t['pagina_inicial'],
      (int) $t['pagina_final'],
      $t['texto']
    );
  }

  $sistema =
    "Você responde perguntas sobre documentos de um condomínio (convenção, regimento interno " .
    "ou atas de assembleia) com base exclusivamente nos trechos de evidência fornecidos abaixo. " .
    "Regras obrigatórias: nunca invente informação que não esteja nos trechos; sempre cite a " .
    "fonte (nome do documento e página) de cada afirmação; se os trechos não contiverem " .
    "evidência suficiente para responder com segurança, diga isso explicitamente em vez de " .
    "arriscar uma resposta; responda em português do Brasil, de forma direta.";

  $mensagem = "Pergunta: {$pergunta}\n\nTrechos de evidência:\n\n{$evidencias}";

  $corpo = json_encode([
    'model' => CLAUDE_MODELO,
    'max_tokens' => CLAUDE_MAX_TOKENS_RESPOSTA,
    'system' => $sistema,
    'messages' => [
      ['role' => 'user', 'content' => $mensagem],
    ],
  ], JSON_UNESCAPED_UNICODE);

  $ch = curl_init(CLAUDE_API_URL);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $corpo,
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'x-api-key: ' . $apiKey,
      'anthropic-version: ' . CLAUDE_API_VERSAO,
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
  ]);
  $resposta = curl_exec($ch);
  $erroCurl = curl_error($ch);
  $codigoHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($resposta === false) {
    throw new RuntimeException('Falha ao chamar a API do Claude: ' . $erroCurl);
  }
  $dados = json_decode($resposta, true);
  if ($codigoHttp !== 200 || !is_array($dados)) {
    $msg = is_array($dados) && is_string($dados['error']['message'] ?? null) ? $dados['error']['message'] : 'resposta inesperada';
    throw new RuntimeException("API do Claude retornou erro ({$codigoHttp}): {$msg}");
  }

  $texto = '';
  foreach (($dados['content'] ?? []) as $bloco) {
    if (($bloco['type'] ?? '') === 'text') $texto .= $bloco['text'];
  }
  if ($texto === '') {
    throw new RuntimeException('Resposta do Claude veio sem texto.');
  }

  return [
    'texto' => $texto,
    'tokensEntrada' => (int) ($dados['usage']['input_tokens'] ?? 0),
    'tokensSaida' => (int) ($dados['usage']['output_tokens'] ?? 0),
  ];
}
