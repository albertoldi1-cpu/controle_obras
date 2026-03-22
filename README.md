# Obra Controle — sistema web de controle de projetos

Sistema para cadastrar **etapas**, **planejamento diário** (cenários **otimista** e **pessimista**) e **execução diária**, com **painel** contendo:

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
git commit -m "Initial commit: Obra Controle"
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

Tudo que você cadastra (projetos, etapas, lançamentos diários, observações de execução) é gravado no banco quando a API faz `commit`. O arquivo **`backend/data.db`** (SQLite local) **não entra no Git**.

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

   Isso copia usuários, projetos, etapas e lançamentos. Em PostgreSQL novo, ajuste as sequências se necessário, por exemplo:  
   `SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id),1) FROM users));` (repita para outras tabelas se usar IDs fixos).

### Login e usuário master

- Na **primeira subida** da API, se não existir nenhum usuário, é criado o master com:
  - `MASTER_USERNAME` (padrão `admin`)
  - `MASTER_PASSWORD` (padrão `admin` — **altere em produção**)
- Acesse a interface em `/login`.  
- Só o **master** vê o menu **Usuários** e pode cadastrar novos logins em `/admin/usuarios`.  
- Defina também **`SECRET_KEY`** (string longa aleatória) em produção para assinar os tokens JWT.

Veja `backend/.env.example` para a lista de variáveis.

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
