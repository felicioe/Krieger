// Protege a tela principal: exige login, redireciona quando a sessão expira e acrescenta ao menu
// lateral os itens "Usuários" (somente administradores), "Minha senha" e "Sair".
(() => {
  const raiz = document.documentElement;
  raiz.style.visibility = 'hidden'; // evita mostrar a tela antes de validar o login
  const liberar = () => { raiz.style.visibility = ''; };
  const irParaLogin = (q = '') => location.replace('login.html' + q);

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const r = await fetchOriginal(...args);
    if (r.status === 401 && String(args[0] && args[0].url || args[0]).includes('api.php')) irParaLogin();
    return r;
  };

  function itemMenu(texto, href, aoClicar) {
    const a = document.createElement('a');
    a.href = href; a.textContent = texto; a.setAttribute('data-kr', '1');
    a._kr = aoClicar || (() => { location.href = href; });
    return a;
  }

  function montarMenu(u) {
    const colocar = () => {
      const nav = document.querySelector('nav');
      if (!nav || nav.querySelector('[data-kr]')) return !!nav;
      if (!nav._krCaptura) { // o React liga seus próprios cliques aos links do menu; este captura antes e impede o conflito
        nav._krCaptura = true;
        nav.addEventListener('click', (e) => {
          const a = e.target.closest && e.target.closest('a[data-kr]');
          if (!a) return;
          e.preventDefault(); e.stopPropagation();
          a._kr();
        }, true);
      }
      const ref = nav.querySelector('.rod');
      const quem = document.createElement('div');
      quem.setAttribute('data-kr', '1');
      quem.style.cssText = 'margin-top:14px;padding:10px 18px 4px;font-size:12px;color:#b9c7dc;border-top:1px solid #ffffff22';
      quem.textContent = u.nome + ' · ' + (u.perfil === 'admin' ? 'Administrador' : 'Usuário');
      const itens = [quem];
      if (u.perfil === 'admin') itens.push(itemMenu('Usuários', 'usuarios.html'));
      itens.push(itemMenu('Minha senha', 'login.html?senha=1'));
      itens.push(itemMenu('Sair', '#', async () => {
        try { await fetchOriginal('auth.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'sair' }) }); } catch {}
        irParaLogin();
      }));
      itens.forEach((el) => nav.insertBefore(el, ref || null));
      return true;
    };
    // O menu é desenhado pelo React depois do carregamento; recoloca os itens se forem removidos.
    new MutationObserver(colocar).observe(document.documentElement, { childList: true, subtree: true });
    colocar();
  }

  (async () => {
    try {
      const r = await fetchOriginal('auth.php?a=eu', { cache: 'no-store' });
      if (r.status === 401) return irParaLogin();
      if (!r.ok) return liberar();
      const { usuario } = await r.json();
      if (usuario.trocarSenha) return irParaLogin('?trocar=1');
      liberar();
      montarMenu(usuario);
    } catch {
      liberar(); // servidor fora do ar: a própria API recusará as chamadas
    }
  })();
})();
