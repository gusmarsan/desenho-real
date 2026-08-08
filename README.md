# Desenho Real — v0.1

Um app simples para crianças transformarem desenhos em imagens realistas com IA.

## Experiência da v0.1

1. Tirar uma foto ou escolher um desenho
2. Conferir a imagem
3. Tocar em **Fazer virar real!**
4. Aguardar a transformação
5. Comparar desenho e resultado
6. Salvar a imagem ou começar outro desenho

A interface foi desenhada pensando em uma criança de aproximadamente 7 anos: poucos passos, botões grandes, textos curtos, feedback visual e nenhuma configuração técnica exposta.

## Arquitetura

- Frontend: HTML, CSS e JavaScript sem framework
- PWA instalável no celular
- Backend serverless: `api/transform.js`
- Geração de imagem: OpenAI Image API
- A chave da OpenAI fica somente no servidor em `OPENAI_API_KEY`

## Publicação recomendada

A v0.1 está preparada para Vercel porque o app precisa de uma função de servidor para proteger a chave da IA. GitHub Pages sozinho não executa o arquivo em `api/`.

### Vercel

1. Importe este repositório na Vercel
2. Em **Settings → Environment Variables**, crie `OPENAI_API_KEY`
3. Faça o deploy

Não coloque a chave da API em `app.js`, `index.html` ou qualquer arquivo público.

## Desenvolvimento

O frontend é estático. A rota `/api/transform` recebe a imagem já redimensionada pelo navegador e chama a API de edição de imagens.

## Versão

`0.1`
