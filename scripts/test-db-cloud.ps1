$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$testDirectory = Join-Path $projectRoot 'supabase\tests\database'
$files = Get-ChildItem -LiteralPath $testDirectory -Filter '*.sql' | Sort-Object Name
$supabase = Join-Path $projectRoot 'node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
if (-not (Test-Path -LiteralPath $supabase)) {
  throw 'The Windows Supabase CLI binary is missing. Run npm install before cloud database tests.'
}

function Invoke-CloudTestFile([string]$testPath) {
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $supabase
  $startInfo.Arguments = "db query --linked --file `"$testPath`""
  $startInfo.WorkingDirectory = $projectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $stdout = $process.StandardOutput.ReadToEndAsync()
  $stderr = $process.StandardError.ReadToEndAsync()

  if (-not $process.WaitForExit(45000)) {
    try {
      $process.Kill($true)
      $process.WaitForExit()
    } catch {
      # The process may exit between the timeout and the kill request.
    }
    return $null
  }

  return [pscustomobject]@{
    Output = $stdout.Result + $stderr.Result
    ExitCode = $process.ExitCode
  }
}

if ($files.Count -eq 0) {
  throw 'No database test files found.'
}

$assertionTotal = 0
foreach ($file in $files) {
  $plan = Select-String -Path $file.FullName -Pattern 'select plan\((\d+)\)' | Select-Object -First 1
  if ($plan) {
    $assertionTotal += [int]$plan.Matches[0].Groups[1].Value
  }

  Write-Host "RUN  $($file.Name)"
  $result = $null
  foreach ($attempt in 1..2) {
    $result = Invoke-CloudTestFile $file.FullName
    if ($result) { break }
    if ($attempt -lt 2) {
      Write-Host "RETRY $($file.Name) after cloud query timeout"
    }
  }

  if (-not $result) {
    throw "Cloud pgTAP timed out twice: $($file.Name)"
  }

  $output = [string]$result.Output
  $exitCode = [int]$result.ExitCode
  $failed = $exitCode -ne 0 -or $output -match '(?i)not ok|failed \d+ test|"_tag"\s*:\s*"Error"'

  if ($failed) {
    Write-Host "FAIL $($file.Name)"
    Write-Host $output
    throw "Cloud pgTAP failed: $($file.Name)"
  }

  Write-Host "PASS $($file.Name)"
}

Write-Host "All cloud pgTAP tests passed: $($files.Count) files, $assertionTotal assertions."
