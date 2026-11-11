import io
p = 'C:/Users/Evandro/projetos/krieger/docs/ESTADO-ATUAL.md'
s = io.open(p, encoding='utf-8').read()
old = '`escolherModeloAta(modelos, cidade, cartorio, tipo)` ordena: cidade+cartório+mesmo tipo >\ncidade+mesmo tipo > cidade+cartório > cidade > geral+mesmo tipo > geral.'
new = '`escolherModeloAta(modelos, cidade, cartorio, tipo)` ordena: cidade+cartório > cidade > geral,\ncom o tipo como desempate dentro de cada nível (modelo com tipo certo vence o sem tipo).'
assert old in s, 'trecho nao encontrado'
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ESTADO-ATUAL atualizado')