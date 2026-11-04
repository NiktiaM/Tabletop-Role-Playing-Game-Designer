$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$project = Split-Path -Parent $PSScriptRoot
$originalPath = $env:PATH
$root = Join-Path $env:RUNNER_TEMP 'Prison запуск test'
New-Item -ItemType Directory -Force -Path $root | Out-Null
foreach ($name in @('Start.cmd', 'Запуск.cmd')) {
    $bytes = [IO.File]::ReadAllBytes((Join-Path $project $name))
    if (@($bytes | Where-Object { $_ -gt 127 }).Count -gt 0) { throw "Non-ASCII launcher: $name" }
    $text = [Text.Encoding]::ASCII.GetString($bytes)
    if ($text.Replace("`r`n", '').Contains("`n")) { throw "Non-CRLF launcher: $name" }
}
function Test-Launch($name, $installed, $noNode, $failCommand, $expectedExit, $expectedCalls) {
    $dir = Join-Path $root $name
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Copy-Item (Join-Path $project 'Start.cmd') (Join-Path $dir 'Start.cmd')
    [IO.File]::WriteAllText((Join-Path $dir 'package.json'), '{}')
    $bin = Join-Path $dir 'bin'
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    $stub = @('@echo off', 'echo %*>>"%CD%\calls.log"', 'if "%PRISON_LAUNCH_TEST_FAIL%"=="%~1" exit /b 9', 'exit /b 0') -join "`r`n"
    [IO.File]::WriteAllText((Join-Path $bin 'npm.cmd'), $stub + "`r`n", [Text.Encoding]::ASCII)
    if ($installed) {
        $deps = Join-Path $dir 'node_modules\.bin'
        New-Item -ItemType Directory -Force -Path $deps | Out-Null
        [IO.File]::WriteAllText((Join-Path $deps 'electron.cmd'), '@exit /b 0')
    }
    $env:PRISON_LAUNCH_TEST_FAIL = $failCommand
    if ($noNode) { $env:PATH = "$env:SystemRoot\System32" }
    else { $env:PATH = "$bin;$originalPath" }
    $command = '""{0}" <nul"' -f (Join-Path $dir 'Start.cmd')
    & $env:ComSpec /d /c $command
    $code = $LASTEXITCODE
    $env:PATH = $originalPath
    if ($code -ne $expectedExit) { throw "$name exit $code, expected $expectedExit" }
    $calls = Join-Path $dir 'calls.log'
    $actual = if (Test-Path $calls) { @(Get-Content $calls) } else { @() }
    if (($actual -join '|') -ne ($expectedCalls -join '|')) { throw "$name unexpected calls: $actual" }
    Write-Host "PASS: $name"
}
try {
    Test-Launch 'fresh' $false $false '' 0 @('ci', 'run build', 'start')
    Test-Launch 'existing' $true $false '' 0 @('run build', 'start')
    Test-Launch 'missing-node' $false $true '' 1 @()
    Test-Launch 'install-failure' $false $false 'ci' 1 @('ci')
    Test-Launch 'build-failure' $true $false 'run' 1 @('run build')
    Test-Launch 'start-failure' $true $false 'start' 1 @('run build', 'start')
} finally {
    $env:PATH = $originalPath
    Remove-Item Env:PRISON_LAUNCH_TEST_FAIL -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $root
}
exit 0
