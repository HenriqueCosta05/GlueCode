<#
.SYNOPSIS
  Prepara o projeto do zero: dependências, verificação da suíte de testes e subir em DEV.

.DESCRIPTION
  Reúne os comandos que a máquina realmente precisa, na ordem em que precisa,
  incluindo os atritos já encontrados neste projeto:

  - o Node vive sob o fnm e não está no PATH de um shell recém-aberto;
  - o pnpm bloqueia scripts de instalação não declarados em pnpm-workspace.yaml;
  - o tsbuildinfo fora de dist/ faz o build emitir só parte do projeto.

  Sem argumento roda tudo: instalar -> verificar -> subir em DEV.

.PARAMETER SkipVerify
  Pula build, lint e testes. Útil quando só se quer subir a aplicação.

.PARAMETER NoDev
  Para depois da verificação, sem subir a aplicação.

.PARAMETER Clean
  Apaga dist/ e coverage/ antes de tudo.

.PARAMETER Smoke
  Sobe a aplicação compilada, consulta /health e /taxes/compare e derruba.
  Toca a rede real (WITS/TRAINS) — os testes, não.

.EXAMPLE
  ./scripts/bootstrap.ps1

.EXAMPLE
  ./scripts/bootstrap.ps1 -Clean -Smoke -NoDev
#>
[CmdletBinding()]
param(
  [switch]$SkipVerify,
  [switch]$NoDev,
  [switch]$Clean,
  [switch]$Smoke
)

$ErrorActionPreference = 'Stop'

$MinNodeMajor = 22
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Write-Step($message) {
  Write-Host ''
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Info($message) {
  Write-Host "    $message" -ForegroundColor DarkGray
}

function Write-Ok($message) {
  Write-Host "    OK  $message" -ForegroundColor Green
}

function Stop-With($message) {
  Write-Host ''
  Write-Host "ERRO: $message" -ForegroundColor Red
  exit 1
}

function Invoke-Checked($label, $command) {
  Write-Info $label
  & $command
  if ($LASTEXITCODE -ne 0) {
    Stop-With "$label falhou (exit $LASTEXITCODE)."
  }
}

# --------------------------------------------------------------------------
# 1. Node
# --------------------------------------------------------------------------
# Quem instala o Node pelo fnm ganha um PATH que só é montado pelo hook de
# shell. Num terminal sem o hook — ou num script — `node` simplesmente não
# existe, e o erro que aparece não diz isso. Resolver aqui evita o diagnóstico.

function Get-NodeMajor {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    return 0
  }

  return [int]((node -v).TrimStart('v').Split('.')[0])
}

function Resolve-Node {
  # Node já utilizável no PATH manda. Trocá-lo por outro só porque existe um
  # gerenciador instalado é rebaixar a máquina de quem já estava bem servido.
  if ((Get-NodeMajor) -ge $MinNodeMajor) {
    return
  }

  $fnmVersions = Join-Path $env:APPDATA 'fnm\node-versions'

  if (Test-Path $fnmVersions) {
    # O diretório do fnm guarda também .downloads, que não é uma versão.
    $candidate = Get-ChildItem $fnmVersions -Directory |
      Where-Object { $_.Name -match '^v(\d+)\.\d+\.\d+$' -and [int]$Matches[1] -ge $MinNodeMajor } |
      Sort-Object { [version]($_.Name.TrimStart('v')) } |
      Select-Object -Last 1

    if ($candidate) {
      $installation = Join-Path $candidate.FullName 'installation'

      if (Test-Path $installation) {
        $env:PATH = "$installation;$env:PATH"
        Write-Info "Node encontrado no fnm: $($candidate.Name)"
        return
      }
    }
  }
}

Write-Step 'Node'
Resolve-Node

$nodeMajor = Get-NodeMajor

if ($nodeMajor -eq 0) {
  Stop-With @'
Node não encontrado no PATH.

Instale-o, ou — se usa fnm/nvm — abra um shell com o hook carregado. A versão
que este projeto pede está em .node-version:
  fnm use --install-if-missing
'@
}

if ($nodeMajor -lt $MinNodeMajor) {
  Stop-With @"
Node v$((node -v).TrimStart('v')) é antigo demais: o projeto exige >= 22.x.

  fnm use --install-if-missing
"@
}

Write-Ok "node instalado na versão $(node -v)"

# --------------------------------------------------------------------------
# 2. Arquivo de ambiente
# --------------------------------------------------------------------------
# A aplicação depende de MONGODB_URI e REDIS_URL (ver .env.example). Sem um
# .env, o NestJS cai nos defaults hardcoded em código — o que funciona para
# Docker Compose (mongo/redis por nome de serviço), mas não para rodar fora
# dele. Criar o .env aqui evita esse silêncio.
Write-Step 'Arquivo de ambiente'

$envExample = Join-Path $ProjectRoot '.env.example'
$envFile = Join-Path $ProjectRoot '.env'

if (-not (Test-Path $envFile)) {
  if (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    Write-Ok 'criado .env a partir de .env.example'
  } else {
    Write-Info '.env.example não encontrado — pulando'
  }
} else {
  Write-Ok '.env já existe'
}

# --------------------------------------------------------------------------
# 3. Limpeza opcional
# --------------------------------------------------------------------------
if ($Clean) {
  Write-Step 'Limpeza'

  foreach ($path in 'dist', 'coverage') {
    if (Test-Path $path) {
      Remove-Item $path -Recurse -Force
      Write-Info "removido $path/"
    }
  }

  # O tsbuildinfo mora dentro de dist/ justamente para morrer junto com ela: o
  # nest-cli apaga dist a cada build, e um cache sobrevivente convence o tsc de
  # que tudo já foi emitido — o build "passa" tendo escrito só main.js.
  Write-Ok 'dist/ e coverage/ limpos'
}

# --------------------------------------------------------------------------
# 4. Dependências
# --------------------------------------------------------------------------
Write-Step 'Dependências'

npm install
Write-Ok 'dependências instaladas'

# --------------------------------------------------------------------------
# 5. Testes e lint
# --------------------------------------------------------------------------
if (-not $SkipVerify) {
  Write-Step 'Verificação de Lint e Testes (Se existirem)'

  Invoke-Checked 'lint' 'npm run lint'
  Invoke-Checked 'test' 'npm run test'


  Write-Ok 'verificação concluída'
}

# --------------------------------------------------------------------------
# 6. Dependências externas (MongoDB / Redis)
# --------------------------------------------------------------------------
# A aplicação não sobe sem Mongo e Redis alcançáveis — DatabaseModule e
# QueueModule conectam de verdade no boot, não sob demanda. Isso só importa
# para rodar a aplicação (dev/smoke): os testes usam mongodb-memory-server e
# não tocam essas portas.

function Test-TcpPort($HostName, $Port, $TimeoutMs = 1000) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $task = $client.ConnectAsync($HostName, $Port)
    if (-not $task.Wait($TimeoutMs)) {
      return $false
    }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Get-DockerComposeCommand {
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose version *> $null
    if ($LASTEXITCODE -eq 0) {
      return 'docker compose'
    }
  }

  if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    return 'docker-compose'
  }

  return $null
}

function Resolve-ExternalDependencies {
  Write-Step 'Dependências externas (MongoDB / Redis)'

  $mongoUp = Test-TcpPort '127.0.0.1' 27017
  $redisUp = Test-TcpPort '127.0.0.1' 6379

  if ($mongoUp -and $redisUp) {
    Write-Ok 'MongoDB (27017) e Redis (6379) já estão de pé'
    return
  }

  $compose = Get-DockerComposeCommand

  if (-not $compose) {
    Stop-With @"
MongoDB e/ou Redis não estão alcançáveis em localhost, e o Docker não foi
encontrado para subi-los automaticamente.

Suba-os manualmente (ex.: mongod e redis-server instalados localmente), ou
instale o Docker Desktop e rode:
  docker compose up -d mongo redis
"@
  }

  Write-Info "subindo dependências via '$compose up -d mongo redis'"
  Push-Location $ProjectRoot
  try {
    Invoke-Expression "$compose up -d mongo redis"
    if ($LASTEXITCODE -ne 0) {
      Stop-With "'$compose up -d mongo redis' falhou (exit $LASTEXITCODE)."
    }
  } finally {
    Pop-Location
  }

  Write-Info 'aguardando MongoDB e Redis responderem...'
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    if ((Test-TcpPort '127.0.0.1' 27017) -and (Test-TcpPort '127.0.0.1' 6379)) {
      Write-Ok 'MongoDB e Redis prontos'
      return
    }
    Start-Sleep -Seconds 2
  }

  Stop-With 'MongoDB e/ou Redis não responderam em 60s. Verifique: docker compose logs mongo redis'
}

# --------------------------------------------------------------------------
# 7. DEV
# --------------------------------------------------------------------------
if ($NoDev) {
  Write-Step 'Pronto'
  Write-Info 'suba a aplicação com: npm run start:dev'
  exit 0
}

Resolve-ExternalDependencies

Write-Step 'Subindo em DEV'

npm run start:dev