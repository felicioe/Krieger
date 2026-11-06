# Marca Krieger — origem das variantes (issue #48)

Nenhuma arte nova foi criada. As três imagens saem da mesma logo oficial:

| Arquivo | Uso | Como foi obtida |
| --- | --- | --- |
| `logo-krieger.png` (900×305) | Fundos claros (login, documentos) | Logo oficial colorida, fundo transparente. |
| `logo-krieger-claro.png` (900×305) | Menu lateral azul-marinho (desktop e gaveta) | Mesma máscara de transparência da oficial (pixel a pixel idêntica); só a cor foi trocada: azul-marinho → branco e azul-acinzentado → azul-claro, para contraste no fundo escuro. |
| `logo-krieger-nome-claro.png` (600×159) | Barra superior do celular (`Marca compacta`) | Recorte da versão clara só com o nome "Krieger", sem o subtítulo, que ficaria ilegível em 32 px de altura. |

Regras de renderização (`src/components/app/Marca.tsx`):
- Sempre `h-auto`/`w-auto` em um dos eixos para manter a proporção original.
- Compacta: 32 px de altura (~121×32 px), branco sobre `--sidebar`.
- Se o escritório fornecer arquivos oficiais próprios para estas variantes, substituir os PNGs mantendo os nomes.
