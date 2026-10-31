<?php
declare(strict_types=1);

/**
 * Resolução central de permissões do Krieger.
 * A tabela pode ainda não existir durante a migração; nesse caso o sistema
 * mantém compatibilidade com o perfil admin e não concede permissões novas a user.
 */
function permissoes_usuario(PDO $pdo, string $usuarioId, string $perfil): array {
  if ($perfil === 'admin') return ['*'];
  try {
    $sql = "SELECT p.chave, COALESCE(up.efeito, 'permitir') AS efeito
            FROM kr_permissoes p
            LEFT JOIN kr_perfil_permissoes pp ON pp.permissao_chave = p.chave
            LEFT JOIN kr_perfis pf ON pf.id = pp.perfil_id AND pf.ativo = 1
            LEFT JOIN kr_usuario_permissoes up ON up.permissao_chave = p.chave AND up.usuario_id = ?
            WHERE p.ativo = 1
              AND (pf.id = ? OR up.usuario_id IS NOT NULL)";
    $st = $pdo->prepare($sql);
    $st->execute([$usuarioId, $perfil]);
    $permitidas = [];
    $negadas = [];
    foreach ($st->fetchAll() as $row) {
      if ($row['efeito'] === 'negar') $negadas[$row['chave']] = true;
      else $permitidas[$row['chave']] = true;
    }
    foreach (array_keys($negadas) as $chave) unset($permitidas[$chave]);
    return array_keys($permitidas);
  } catch (PDOException $e) {
    if (str_contains(strtolower($e->getMessage()), 'doesn\'t exist') || str_contains(strtolower($e->getMessage()), 'does not exist')) return [];
    throw $e;
  }
}

function tem_permissao(array $usuario, string $chave): bool {
  return in_array('*', $usuario['permissoes'] ?? [], true)
      || in_array($chave, $usuario['permissoes'] ?? [], true);
}

function exigir_permissao(array $usuario, string $chave): void {
  if (!tem_permissao($usuario, $chave)) json_erro('Você não tem permissão para esta ação.', 403, ['codigo' => 'permissao']);
}
