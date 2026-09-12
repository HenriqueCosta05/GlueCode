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
# 7. DEV
# --------------------------------------------------------------------------
if ($NoDev) {
  Write-Step 'Pronto'
  Write-Info 'suba a aplicação com: npm run dev'
  exit 0
}

Write-Step 'Subindo em DEV'

npm run dev