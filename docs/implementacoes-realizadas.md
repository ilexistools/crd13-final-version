# Implementacoes realizadas

Resumo das implementacoes adicionadas na versao `v2.0.2`.

## Backend Docker

Foi criado o arquivo `backend/Dockerfile` para empacotar o backend FastAPI em uma imagem Docker. A imagem usa Python 3.12 com `uv`, instala as dependencias a partir de `pyproject.toml` e `uv.lock`, copia a aplicacao em `app/` e executa o servidor com:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

A porta exposta pelo container e `8000`.

## Backend Docker Ignore

Foi criado `backend/.dockerignore` para evitar que arquivos locais e desnecessarios entrem no contexto de build, como ambiente virtual, caches Python, arquivos `.env` e o proprio `Dockerfile`.

## Frontend Docker

Foi criado o arquivo `new-frontend/Dockerfile` para gerar uma imagem de producao do frontend React/Vite. O build acontece em uma etapa Node.js com `npm ci` e `npm run build`; depois, os arquivos finais de `dist/` sao servidos por Nginx.

O build aceita o argumento:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

Esse valor define a URL base usada pelo frontend para acessar a API.

## Frontend Nginx

Foi criado `new-frontend/nginx/default.conf` para servir a SPA pelo Nginx. A configuracao usa `try_files` para redirecionar rotas internas do React Router para `index.html`, preservando a navegacao client-side.

## Frontend Docker Ignore

Foi criado `new-frontend/.dockerignore` para reduzir o contexto de build, excluindo `node_modules`, `dist`, arquivos `.env`, logs de npm e o proprio `Dockerfile`.

## Versionamento

As implementacoes foram commitadas em `898ee63` com a mensagem:

```text
Add Dockerfiles for backend and frontend
```

Em seguida, foi criada e enviada ao GitHub a tag anotada `v2.0.2`.

## Validacoes

Foram realizadas duas validacoes locais:

```bash
npm run build
```

no `new-frontend`, confirmando que o build Vite compila corretamente.

```bash
uv run python -c "from app.main import app; print(app.title)"
```

no `backend`, confirmando que a aplicacao FastAPI pode ser importada.

Nao foi possivel executar `docker build` localmente porque o comando `docker` nao estava disponivel no ambiente.
