Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Use-RepoNode.ps1')

$exitCode = Invoke-RepoNpm -NpmArgs @('run', 'build')
exit $exitCode
