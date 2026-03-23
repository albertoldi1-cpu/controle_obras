# Controle de Obras de Grande Porte

Sistema web para cadastrar **etapas**, **planejamento diário** (cenários **otimista** e **pessimista**) e **execução diária**, com **painel** contendo:

- **Farol por etapa** (verde / amarelo / vermelho) conforme o realizado versus os dois cenários na data de referência  
- **Curva S** do avanço físico da obra (percentual acumulado ponderado pelos pesos — mesma lógica da planilha de avanço físico)  
- **Desvios** em **percentual relativo** ao previsto otimista e pessimista; curva **executada** só até o último dia com produção  
- **Usuários** com login; **master** cadastra demais usuários  
- **Tendência** de ritmo de execução e de avanço acumulado no curto prazo  

Interface pensada para uso **intuitivo** e visual **moderno** (tema escuro, tipografia clara, gráficos legíveis para reunião com cliente).

## Repositório Git

O projeto inclui `.gitignore` adequado (`node_modules`, `backend/data.db`, caches não são versionados).

**Primeira vez — criar o repositório local e o primeiro commit:**

```bash
cd obra-controle-web
bash scripts/init-git.sh
```

Ou manualmente:

```bash
cd obra-controle-web
git init
git branch -M main
git add -A
git commit -m "Initial commit: Controle de Obras de Grande Porte"
```

Depois, no GitHub, crie um repositório vazio e:

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

### Salvar tudo e preparar envio ao GitHub (no seu Mac)

O Cursor às vezes **não consegue criar a pasta `.git`**. Use o **Terminal.app** (ou iTerm) na pasta do projeto:

```bash
cd /Users/andreluizfrancisco/obra-controle-web
bash scripts/push-github.sh
```

Opcionalmente defina a mensagem do commit:

```bash
bash scripts/push-github.sh "Minha mensagem de commit"
```

Em seguida:

1. Em [github.com/new](https://github.com/new) crie um repositório **sem** README e **sem** .gitignore (repositório vazio).
2. Conecte e envie (troque `USUARIO` e `REPO`):

```bash
git remote add origin https://github.com/USUARIO/REPO.git
git branch -M main
git push -u origin main
```

- Se o Git pedir senha no HTTPS, use um **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens), não a senha da conta.
- Ou use **SSH**: `git remote add origin git@github.com:USUARIO/REPO.git` (com chave SSH cadastrada no GitHub).

Atualizações futuras:

```bash
cd /Users/andreluizfrancisco/obra-controle-web
bash scripts/push-github.sh
git push
```

## Requisitos

- Python 3.9+  
- Node.js 18+ (para o frontend)

## Executar em desenvolvimento (sua máquina)

### 1. Backend

```bash
cd backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API: [http://127.0.0.1:8000](http://127.0.0.1:8000) · documentação interativa: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

O banco SQLite é criado em `backend/data.db`.

### Persistência dos dados

Tudo que você cadastra (projetos, etapas, lançamentos diários, observações de execução) é gravado no banco quando a API faz `commit`. O arquivo **`backend/data.db`** (SQLite local) **não entra no Git** — ou seja, **dados digitados no programa não são enviados ao GitHub**; só o código sobe.

### Render e nuvem: por que os dados “sumiram” e como recuperar

Em plataformas como o **Render**, o disco do **container** é em geral **efêmero**: a cada **novo deploy** ou reinício, um SQLite criado só dentro da instância **some**, a menos que exista **disco persistente** dedicado (e mesmo assim, em produção o recomendável é **PostgreSQL**).

| Onde estavam os dados | O que fazer |
|------------------------|-------------|
| Só no seu computador (`backend/data.db`) | Eles **não foram para o Render** automaticamente. Configure **`DATABASE_URL`** com um PostgreSQL, rode localmente `python3 scripts/sqlite_to_postgres.py` (com `DATABASE_URL` apontando para esse banco) para **copiar** usuários, projetos, etapas e lançamentos, depois redeploy com a mesma URL. |
| Já no PostgreSQL do Render | Use **sempre a mesma** instância de banco e a **mesma** `DATABASE_URL` no serviço web. Os dados permanecem no Postgres; não confie em SQLite dentro do container. |
| Perdidos após deploy sem Postgres | Infelizmente **não há como recuperar** o que estava só no SQLite efêmero do container. A partir daí: Postgres + backup. |

**Resumo:** para produção na nuvem, defina **`DATABASE_URL`** (PostgreSQL) **antes** de usar o sistema de verdade; faça **backup** pelo painel do provedor do banco.

### Banco online (PostgreSQL) sem perder dados

1. Crie um banco gerenciado (Neon, Supabase, Railway, RDS, etc.) e copie a URL de conexão.  
2. Defina a variável de ambiente **`DATABASE_URL`** no formato:

   `postgresql+psycopg2://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO`

3. Reinicie a API: as tabelas são criadas automaticamente.  
4. Para **migrar** o que já está no SQLite:

   ```bash
   export DATABASE_URL="postgresql+psycopg2://..."
   python3 scripts/sqlite_to_postgres.py
   ```

   Isso copia usuários, projetos, etapas, lançamentos diários e **lançamentos financeiros** (avanço produtivo). Em PostgreSQL novo, ajuste as sequências se necessário, por exemplo:  
   `SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id),1) FROM users));` (repita para outras tabelas se usar IDs fixos).

### Login e usuário master

- Na **primeira subida** da API, se não existir nenhum usuário, é criado o usuário **master**. Usuário e senha padrão vêm de **`backend/app/auth_util.py`**; em produção use **`MASTER_USERNAME`** e **`MASTER_PASSWORD`** no ambiente (não divulgue senhas na interface pública).
- **Não consegue logar?** O banco pode ainda ter credenciais antigas. Com a API **parada**, na raiz do projeto: `python3 scripts/reset_master.py` — apaga todos os usuários e recria só o master conforme `auth_util.py` ou as variáveis de ambiente.
- Acesse a interface em `/login`.  
- Só o **master** vê o menu **Usuários** e pode cadastrar novos logins em `/admin/usuarios`.  
- Recomenda-se **`SECRET_KEY`** (string longa aleatória) para assinar os tokens JWT em produção; se não houver, usa-se o padrão de desenvolvimento.

Veja `backend/.env.example` para a lista de variáveis.

### Segurança (API e banco)

- **Recomendado em produção:** defina **`SECRET_KEY`** (ou **`JWT_SECRET`**) longa e aleatória e **`MASTER_PASSWORD`** no ambiente; sem isso, o sistema usa valores padrão do código (menos seguro em ambiente público).
- **CORS:** em produção, sem `CORS_ORIGINS`, usa **`RENDER_EXTERNAL_URL`**. Para vários domínios, defina `CORS_ORIGINS` separados por vírgula.
- **PostgreSQL no Render:** `sslmode=require` é acrescentado automaticamente à `DATABASE_URL` quando `RENDER=true`.
- **Cabeçalhos HTTP:** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` (em produção).
- **Login:** limite de tentativas por IP (memória; instância única).
- **Documentação OpenAPI (`/docs`):** desligada em produção; para forçar no Render, use **`FORCE_API_DOCS=1`** (não recomendado em ambiente público sem autenticação extra).

### Aba Financeiro (avanço produtivo)

Dentro de cada projeto, a guia **Financeiro** segue as colunas da planilha **AVANÇO PRODUTIVO** (ex.: *CALCULO OBRA DAMHA.xlsx*): data da execução, tipo de equipe, segmento, UEN, obra, código de mão de obra, descrição, quantidade, UPS, R$ UPS e valor — com **curva acumulada** e **totais por equipe**.

### Backup por e-mail (somente variáveis de ambiente)

**Nunca** coloque senha de e-mail no código nem no Git. O master pode usar **Usuários → Enviar backup agora** se o servidor tiver SMTP configurado:

| Variável | Exemplo |
|----------|---------|
| `BACKUP_SMTP_HOST` | `smtp.gmail.com` |
| `BACKUP_SMTP_PORT` | `587` |
| `BACKUP_SMTP_USER` | seu e-mail Gmail |
| `BACKUP_SMTP_PASSWORD` | **senha de app** do Google (não a senha da conta) |
| `BACKUP_EMAIL_FROM` | opcional; padrão = `BACKUP_SMTP_USER` |
| `BACKUP_EMAIL_TO` | destino do backup |

No Google: Conta → Segurança → **Senhas de app** (com verificação em duas etapas). O anexo é **JSON compactado (gzip)** com usuários (hashes), projetos, etapas, lançamentos diários e financeiros.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface: [http://127.0.0.1:5173](http://127.0.0.1:5173)

O Vite está configurado para **proxy** de `/api` para o backend na porta 8000.

**Um comando (API + interface):** na raiz do projeto, após `pip install` e `npm install`:

```bash
chmod +x start-dev.sh
./start-dev.sh
```

### Endereços corretos

| O que você quer        | URL |
|------------------------|-----|
| **Tela do sistema**    | **http://127.0.0.1:5173** (com `npm run dev` rodando) |
| Documentação da API    | http://127.0.0.1:8000/docs |
| Só teste se a API vive | http://127.0.0.1:8000/api/health |

A **interface não fica na porta 8000**. Se abrir só `http://127.0.0.1:8000`, verá JSON da API (e na raiz `/` uma dica).

### Se “não conecta” ou a página não carrega

1. **Suba os dois**: backend (8000) **e** frontend (5173). Só o Vite sem a API deixa o painel falhar ao buscar dados.  
2. **Porta 8000 livre**: outro programa usando 8000 impede a API; troque a porta no `uvicorn` e no `vite.config.ts` → `proxy.target`.  
3. **Acesso pelo celular na mesma Wi‑Fi**: o Vite agora usa `--host`; no terminal do Vite aparece algo como `Network: http://192.168.x.x:5173` — use esse endereço no celular (a API continua em `127.0.0.1` na máquina; o proxy do Vite encaminha `/api`).  
4. **Firewall macOS**: em “Firewall”, permita Python/Node se bloquear conexões de entrada.

### Fluxo de uso

1. Faça **login** (usuário master ou outro cadastrado pelo master).  
2. Crie um **projeto** na página inicial.  
3. Em **Etapas**, cadastre cada etapa: **peso** (0–1, o mesmo peso vale para **ambos** os cenários), **quantidade total** e unidade. Use **editar** (ícone lápis) ao lado de excluir para alterar uma etapa.  
4. Em **Lançamentos**, use a **janela de planejamento** (otimista/pessimista por dia) e o botão **Salvar planejamento**; use a **janela de execução** (produzido + **observação** do dia) e **Salvar execução e observações**.  
5. Abra **Painel** para farol, curva S (linha executada até o último dia com produção), desvios em % e tendência.

## Compartilhar na web (produção)

Opções comuns:

### A) Um único servidor (VPS, EC2, etc.)

1. Build do frontend: `cd frontend && npm run build` (gera `frontend/dist`).  
2. Sirva `dist` com **nginx** (ou Caddy) e faça **proxy reverso** de `/api` para o Uvicorn na porta 8000.  
3. Rode o backend com process manager (systemd, pm2, etc.):

   ```bash
   cd backend
   python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

4. Configure **HTTPS** (Let’s Encrypt) para acesso seguro.

### B) Frontend em CDN + API em nuvem

- Hospede o build estático (Vercel, Netlify, Cloudflare Pages).  
- Defina `VITE_API_BASE` apontando para a URL pública da API (ex.: `https://api.suaempresa.com`) e rode `npm run build` de novo.  
- Hospede a API (Railway, Fly.io, Render, etc.) com a mesma `DATABASE_URL` persistente (para SQLite, use volume em disco ou troque para PostgreSQL depois).

### B.1) Render (Docker + um único URL)

O repositório inclui **`Dockerfile`** (build do React + API FastAPI) e **`render.yaml`** (modelo de serviço web).

1. No [Render](https://render.com), crie um **PostgreSQL** (ou use [Neon](https://neon.tech) / outro) e copie a URL de conexão.  
2. **New → Blueprint** e selecione este repositório, ou **New → Web Service** com *Docker* e raiz do repositório.  
3. Variáveis de ambiente no serviço web:
   - **`DATABASE_URL`** — obrigatória em produção (o backend normaliza `postgres://` para `postgresql+psycopg2://`).  
   - **`SECRET_KEY`** / **`JWT_SECRET`** — recomendadas (chave longa para JWT); se omitidas, usa-se o padrão de desenvolvimento.  
   - **`MASTER_PASSWORD`** / **`MASTER_USERNAME`** — opcionais; padrões em `auth_util.py` se não definidos.  
   - Opcional: variáveis de **backup por e-mail** (ver secção acima).  
4. Health check: caminho **`/api/health`**.  
5. Após o deploy, abra a URL do serviço: a **interface** e a **API** ficam no mesmo domínio (`/` e `/api/...`); não é necessário `VITE_API_BASE`.

**Persistência:** cadastros só se mantêm entre deploys se **`DATABASE_URL`** for um **PostgreSQL** fixo (o mesmo em todo deploy). Sem isso, o SQLite dentro do container é efêmero — veja a seção **Render e nuvem: por que os dados “sumiram”** acima e o script **`scripts/sqlite_to_postgres.py`** para trazer dados do `data.db` local.

**Web Service manual (sem Blueprint):** ambiente **Docker** · **Dockerfile path** `Dockerfile` · **Docker build context** `.` (raiz do repo) · **Start Command** em branco (usa o `CMD` do Dockerfile) · defina **`PORT`** apenas se o painel exigir; o Render costuma injetar `PORT` sozinho.

**Se o build falhou com “Could not open requirements.txt”:** o serviço está como **Python** na raiz do repo, onde antes não havia `requirements.txt`. Há agora um **`requirements.txt` na raiz** que aponta para `backend/` — faça **commit, push** e rode o deploy de novo. **Melhor ainda:** em **Settings → Build & Deploy**, mude **Environment** para **Docker** (e use o `Dockerfile` na raiz), assim o Render não depende do build nativo em Python e o frontend entra na imagem automaticamente.

**Se mantiver runtime Python (não Docker):** defina **`NODE_VERSION`** `20` (ou `18`) nas variáveis de ambiente para o Render instalar o Node no build. **Build Command:**

`pip install -r requirements.txt && cd frontend && npm ci && npm run build`

**Start Command:**

`cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`

**Erro em `pydantic-core` / `metadata-generation-failed`:** o build nativo em Python estava usando **3.14**, onde muitas dependências ainda não têm wheel e o `pip` tenta compilar e falha. O repositório inclui **`.python-version`** na raiz com **`3.12.8`** para o Render usar Python estável. Se o painel ainda escolher 3.14, crie a variável de ambiente **`PYTHON_VERSION`** = `3.12.8` (ou `3.12.11`) no serviço e faça um novo deploy.

Teste local da imagem:

```bash
docker build -t obra-controle .
# Sem DATABASE_URL: usa SQLite dentro do container (só para teste).
docker run --rm -p 8000:8000 -e SECRET_KEY="dev" obra-controle
# Com PostgreSQL:
docker run --rm -p 8000:8000 -e SECRET_KEY="dev" -e DATABASE_URL="postgresql+psycopg2://..." obra-controle
```

Ou, na raiz do projeto: `chmod +x scripts/docker-run-local.sh` e `./scripts/docker-run-local.sh` (interface em [http://127.0.0.1:8080](http://127.0.0.1:8080) por padrão).

### C) Rede local / VPN

- Suba backend e frontend na mesma rede ou atrás de **Tailscale** / **WireGuard** para compartilhar só com o time, sem expor à internet pública.

## Variáveis de ambiente (frontend)

| Variável         | Uso |
|------------------|-----|
| `VITE_API_BASE`  | URL base da API em produção (ex.: `https://api.exemplo.com`). Vazio = mesma origem + proxy em dev. |

## API principal

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET/POST | `/api/projects` | Listar / criar projeto |
| GET | `/api/projects/{id}` | Detalhe do projeto |
| GET/POST | `/api/projects/{id}/stages` | Listar / criar etapa |
| PATCH/DELETE | `/api/stages/{id}` | Atualizar / excluir etapa |
| GET | `/api/stages/{id}/entries` | Lançamentos da etapa |
| PUT | `/api/stages/{id}/entries/{day}` | Upsert de um dia |
| POST | `/api/projects/{id}/entries/bulk` | Gravar vários dias de uma vez |
| GET | `/api/projects/{id}/dashboard` | Painel (curva S, farol, tendência) |

## Licença

Uso interno do projeto / obra — ajuste conforme sua política.
