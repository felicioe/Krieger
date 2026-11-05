<?php
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(403); exit; }

/** Filtra e remove o PDF no banco: o PHP recebe apenas metadados e o tamanho. */
function listar_metadados_anexos(PDO $pdo, string $exercicioId): array {
  $stmt = $pdo->prepare("SELECT JSON_REMOVE(dados, '$.arquivoDataUrl') AS dados,
      CHAR_LENGTH(SUBSTRING_INDEX(arquivo, ',', -1)) AS tamanho_base64,
      RIGHT(arquivo, 2) AS final_base64, arquivo <> '' AS tem_arquivo
    FROM (
      SELECT dados, CASE WHEN JSON_TYPE(JSON_EXTRACT(dados, '$.arquivoDataUrl')) = 'STRING'
        THEN JSON_UNQUOTE(JSON_EXTRACT(dados, '$.arquivoDataUrl')) ELSE '' END AS arquivo
      FROM kr_anexos_importacao
      WHERE JSON_UNQUOTE(JSON_EXTRACT(dados, '$.exercicioId')) = ?
    ) AS anexos");
  $stmt->execute([$exercicioId]);
  return array_map(static function (array $linha): array {
    $anexo = json_decode($linha['dados'], true, 512, JSON_THROW_ON_ERROR);
    $final = (string) $linha['final_base64'];
    $sobra = $final === '==' ? 2 : (str_ends_with($final, '=') ? 1 : 0);
    $anexo['arquivoBytes'] = max(0, (int) floor((int) $linha['tamanho_base64'] * 3 / 4) - $sobra);
    $anexo['temArquivo'] = (bool) $linha['tem_arquivo'];
    return $anexo;
  }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}
