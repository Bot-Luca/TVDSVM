# Consagração a Nossa Senhora — Planner

Protótipo web (mobile-first) para acompanhar a Consagração a Jesus por Maria
segundo o método de São Luís Maria Grignion de Montfort: leitura do Tratado
em 4 semanas, seguida de 33 dias de Exercícios Espirituais, terminando na
data da festa mariana escolhida.

## Rodar localmente

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente `http://localhost:5173`).

## Editar cores, fontes e textos

Tudo isso fica em `src/App.jsx`:

- **Cores**: procure `:root {` perto do fim do arquivo (dentro da função
  `Styles`) — lá estão as variáveis `--bg`, `--gold`, `--rose`, `--week1`
  a `--week4`, etc., cada uma comentada.
- **Fontes**: logo acima das cores, na linha do `@import url('https://fonts.googleapis.com/...')`.
- **Datas e regras de cada festa mariana**: no topo do arquivo, na constante
  `DEVOTIONS`.
- **Capítulos/páginas do Tratado**: constante `READING_PLAN`, também no topo.

## Publicar no GitHub

Se ainda não tem o repositório criado:

1. Crie uma conta em [github.com](https://github.com) (se ainda não tiver).
2. No canto superior direito do GitHub, clique em **+ → New repository**.
3. Dê um nome (ex.: `consagracao-nossa-senhora`), deixe **Public**, **não**
   marque nenhuma opção de criar README/gitignore (já temos os nossos), e
   clique em **Create repository**.
4. O GitHub vai te mostrar alguns comandos. No seu computador, dentro desta
   pasta do projeto, rode:

```bash
git init
git add .
git commit -m "Primeira versão do planner de consagração"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/consagracao-nossa-senhora.git
git push -u origin main
```

(troque `SEU-USUARIO` e o nome do repositório pelos que você escolheu)

## Publicar o site de graça (GitHub Pages)

Este projeto já vem com um arquivo pronto
(`.github/workflows/deploy.yml`) que publica o site automaticamente toda
vez que você enviar (`push`) algo para a branch `main`. Só falta ligar isso
no GitHub, uma vez só:

1. No repositório, vá em **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Pronto. Depois do próximo `git push`, aguarde 1–2 minutos e o site estará
   em `https://SEU-USUARIO.github.io/consagracao-nossa-senhora/` (você pode
   acompanhar o progresso na aba **Actions** do repositório).

## Adicionar seus PDFs (Tratado e Exercícios diários)

Coloque os arquivos na pasta `public/pdfs/`, com o nome exato abaixo — o
site detecta sozinho se o arquivo existe e mostra o PDF automaticamente na
hora certa, sem precisar editar nenhum código:

```
public/pdfs/tratado/semana-1.pdf
public/pdfs/tratado/semana-2.pdf
public/pdfs/tratado/semana-3.pdf
public/pdfs/tratado/semana-4.pdf

public/pdfs/exercicios/dia-01.pdf
public/pdfs/exercicios/dia-02.pdf
...
public/pdfs/exercicios/dia-34.pdf
```

Detalhes importantes:

- Os dias dos Exercícios sempre usam **2 dígitos** (`dia-01`, não `dia-1`).
- Alguns ciclos têm 33 dias, outros 34 — prepare até o `dia-34.pdf` pra
  cobrir qualquer uma das datas marianas disponíveis na aba "Escolher".
- Enquanto um PDF ainda não existe, o app mostra normalmente o aviso de
  "espaço reservado" no lugar dele — nada quebra.
- Depois de adicionar os PDFs, é só fazer `git add`, `git commit` e
  `git push` de novo (veja a seção "Publicar no GitHub" acima) que o site
  publicado atualiza sozinho.
- Se quiser mudar os nomes/pastas usados, procure por `treatisePdfUrl` e
  `exercisePdfUrl` no início de `src/App.jsx`.
