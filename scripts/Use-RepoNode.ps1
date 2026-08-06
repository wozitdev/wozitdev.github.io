Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoNodeRoot {
  param(
    [string]$RepoRoot
  )

  $toolsPath = Join-Path $RepoRoot '.local-tools'
  if (-not (Test-Path $toolsPath)) {
    return $null
  }

  $candidate = Get-ChildItem -Path $toolsPath -Directory |
    Where-Object { $_.Name -like 'node-v*-win-x64' } |
    Sort-Object Name -Descending |
    Select-Object -First 1

  if (-not $candidate) {
    return $null
  }

  return $candidate.FullName
}

function Assert-NodeVersion {
  param(
    [string]$NodeExe,
    [int]$MinimumMajor = 20
  )

  $nodeVersion = (& $NodeExe --version).Trim()
  if (-not $nodeVersion) {
    throw 'Unable to read Node.js version.'
  }

  $major = [int](($nodeVersion.TrimStart('v')).Split('.')[0])
  if ($major -lt $MinimumMajor) {
    throw "Node.js $nodeVersion detected. This repo requires Node.js >= $MinimumMajor for dependency scripts."
  }

  return $nodeVersion
}

function Invoke-RepoNpm {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$NpmArgs,

    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  )

  $repoNodeRoot = Get-RepoNodeRoot -RepoRoot $RepoRoot

  if ($repoNodeRoot) {
    $nodeExe = Join-Path $repoNodeRoot 'node.exe'
    $npmCli = Join-Path $repoNodeRoot 'node_modules\npm\bin\npm-cli.js'

    if ((Test-Path $nodeExe) -and (Test-Path $npmCli)) {
      $nodeVersion = Assert-NodeVersion -NodeExe $nodeExe
      $env:PATH = "$repoNodeRoot;$env:PATH"
      Write-Host "Using repo Node runtime: $nodeVersion ($repoNodeRoot)"
      & $nodeExe $npmCli @NpmArgs
      return $LASTEXITCODE
    }
  }

  $fallbackNode = (Get-Command node -ErrorAction Stop).Source
  $fallbackVersion = Assert-NodeVersion -NodeExe $fallbackNode
  Write-Host "Using system Node runtime: $fallbackVersion ($fallbackNode)"
  & npm @NpmArgs
  return $LASTEXITCODE
}
