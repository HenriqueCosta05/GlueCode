#!/usr/bin/env bash
#
# Prepara o projeto do zero: dependências, verificação da suíte de testes e
# subir em DEV. Versão bash de scripts/bootstrap.ps1 — mesma ordem, mesmos
# atritos resolvidos:
#
#   - o Node vive sob o fnm/nvm e não está no PATH de um shell recém-aberto;
#   - a aplicação não sobe sem MongoDB e Redis alcançáveis;
#   - sem .env, os defaults de conexão assumem nomes de serviço do Compose.
#
# Sem argumento roda tudo: instalar -> verificar -> subir em DEV.
#
# Uso:
#   ./scripts/bootstrap.sh [--skip-verify] [--no-dev] [--clean] [--smoke]
#
#   --skip-verify   Pula lint e testes. Útil quando só se quer subir a app.
#   --no-dev        Para depois da verificação, sem subir a aplicação.
#   --clean         Apaga dist/ e coverage/ antes de tudo.
#   --smoke         Reservado (ver bootstrap.ps1) — não implementado aqui ainda.
#
# Exemplos:
#   ./scripts/bootstrap.sh
#   ./scripts/bootstrap.sh --clean --no-dev

set -euo pipefail

MIN_NODE_MAJOR=22
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SKIP_VERIFY=0
NO_DEV=0
CLEAN=0
SMOKE=0

for arg in "$@"; do
  case "$arg" in
    --skip-verify) SKIP_VERIFY=1 ;;
    --no-dev) NO_DEV=1 ;;
    --clean) CLEAN=1 ;;
    --smoke) SMOKE=1 ;;
    *)
      echo "Argumento desconhecido: $arg" >&2
      exit 1
      ;;
  esac
done

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
info() { printf '    \033[90m%s\033[0m\n' "$1"; }
ok() { printf '    \033[32mOK  %s\033[0m\n' "$1"; }
die() {
  printf '\n\033[31mERRO: %s\033[0m\n' "$1" >&2
  exit 1
}

run_checked() {
  local label="$1"
  shift
  info "$label"
  if "$@"; then
    return 0
  fi
  local status=$?
  die "$label falhou (exit $status)."
}

# --------------------------------------------------------------------------
# 1. Node
# --------------------------------------------------------------------------
# Quem instala o Node pelo fnm/nvm ganha um PATH que só é montado pelo hook de
# shell. Num terminal sem o hook — ou num script — `node` simplesmente não
# existe, e o erro que aparece não diz isso. Resolver aqui evita o diagnóstico.

node_major() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi
  node -v | sed 's/^v//' | cut -d. -f1
}

resolve_node() {
  # Node já utilizável no PATH manda. Trocá-lo por outro só porque existe um
  # gerenciador instalado é rebaixar a máquina de quem já estava bem servido.
  if [ "$(node_major)" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
    return
  fi

  # fnm: ativa o ambiente do shell atual se o binário existir.
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --shell bash 2>/dev/null)" || true
    if [ "$(node_major)" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
      info "Node ativado via fnm: $(node -v)"
      return
    fi
  fi

  # nvm: carrega o script se instalado e tenta usar a versão do projeto.
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$nvm_dir/nvm.sh"
    nvm use --silent 2>/dev/null || nvm use --silent default 2>/dev/null || true
    if [ "$(node_major)" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
      info "Node ativado via nvm: $(node -v)"
      return
    fi
  fi
}

step 'Node'
resolve_node

NODE_MAJOR="$(node_major)"

if [ "$NODE_MAJOR" -eq 0 ]; then
  die "Node não encontrado no PATH.

Instale-o, ou — se usa fnm/nvm — abra um shell com o hook carregado:
  fnm use --install-if-missing"
fi

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  die "Node $(node -v) é antigo demais: o projeto exige >= ${MIN_NODE_MAJOR}.x.

  fnm use --install-if-missing"
fi

ok "node instalado na versão $(node -v)"

# --------------------------------------------------------------------------
# 2. Arquivo de ambiente
# --------------------------------------------------------------------------
# A aplicação depende de MONGODB_URI e REDIS_URL (ver .env.example). Sem um
# .env, o NestJS cai nos defaults hardcoded em código — o que funciona para
# Docker Compose (mongo/redis por nome de serviço), mas não para rodar fora
# dele. Criar o .env aqui evita esse silêncio.
step 'Arquivo de ambiente'

ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    ok 'criado .env a partir de .env.example'
  else
    info '.env.example não encontrado — pulando'
  fi
else
  ok '.env já existe'
fi

# --------------------------------------------------------------------------
# 3. Limpeza opcional
# --------------------------------------------------------------------------
if [ "$CLEAN" -eq 1 ]; then
  step 'Limpeza'

  for path in dist coverage; do
    if [ -d "$PROJECT_ROOT/$path" ]; then
      rm -rf "${PROJECT_ROOT:?}/$path"
      info "removido $path/"
    fi
  done

  # O tsbuildinfo mora dentro de dist/ justamente para morrer junto com ela: o
  # nest-cli apaga dist a cada build, e um cache sobrevivente convence o tsc de
  # que tudo já foi emitido — o build "passa" tendo escrito só main.js.
  ok 'dist/ e coverage/ limpos'
fi

# --------------------------------------------------------------------------
# 4. Dependências
# --------------------------------------------------------------------------
step 'Dependências'

(cd "$PROJECT_ROOT" && npm install)
ok 'dependências instaladas'

# --------------------------------------------------------------------------
# 5. Testes e lint
# --------------------------------------------------------------------------
if [ "$SKIP_VERIFY" -eq 0 ]; then
  step 'Verificação de Lint e Testes (Se existirem)'

  (cd "$PROJECT_ROOT" && run_checked 'lint' npm run lint)
  (cd "$PROJECT_ROOT" && run_checked 'test' npm run test)

  ok 'verificação concluída'
fi

# --------------------------------------------------------------------------
# 6. Dependências externas (MongoDB / Redis)
# --------------------------------------------------------------------------
# A aplicação não sobe sem Mongo e Redis alcançáveis — DatabaseModule e
# QueueModule conectam de verdade no boot, não sob demanda. Isso só importa
# para rodar a aplicação (dev/smoke): os testes usam mongodb-memory-server e
# não tocam essas portas.

tcp_port_open() {
  local host="$1" port="$2"
  (exec 3<>"/dev/tcp/$host/$port") >/dev/null 2>&1
}

docker_compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo 'docker compose'
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo 'docker-compose'
    return
  fi
  echo ''
}

resolve_external_dependencies() {
  step 'Dependências externas (MongoDB / Redis)'

  if tcp_port_open 127.0.0.1 27017 && tcp_port_open 127.0.0.1 6379; then
    ok 'MongoDB (27017) e Redis (6379) já estão de pé'
    return
  fi

  local compose
  compose="$(docker_compose_cmd)"

  if [ -z "$compose" ]; then
    die "MongoDB e/ou Redis não estão alcançáveis em localhost, e o Docker não foi
encontrado para subi-los automaticamente.

Suba-os manualmente (ex.: mongod e redis-server instalados localmente), ou
instale o Docker e rode:
  docker compose up -d mongo redis"
  fi

  info "subindo dependências via '$compose up -d mongo redis'"
  if ! (cd "$PROJECT_ROOT" && $compose up -d mongo redis); then
    die "'$compose up -d mongo redis' falhou."
  fi

  info 'aguardando MongoDB e Redis responderem...'
  local deadline=$((SECONDS + 60))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if tcp_port_open 127.0.0.1 27017 && tcp_port_open 127.0.0.1 6379; then
      ok 'MongoDB e Redis prontos'
      return
    fi
    sleep 2
  done

  die 'MongoDB e/ou Redis não responderam em 60s. Verifique: docker compose logs mongo redis'
}

# --------------------------------------------------------------------------
# 7. DEV
# --------------------------------------------------------------------------
if [ "$NO_DEV" -eq 1 ]; then
  step 'Pronto'
  info 'suba a aplicação com: npm run start:dev'
  exit 0
fi

resolve_external_dependencies

step 'Subindo em DEV'

(cd "$PROJECT_ROOT" && npm run start:dev)
