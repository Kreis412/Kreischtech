$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$secretPath = Join-Path $PSScriptRoot 'data/openai-key.dpapi'
$bytes = [System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String([System.IO.File]::ReadAllText($secretPath)), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
try {
 $key = [System.Text.Encoding]::UTF8.GetString($bytes)
 $response = Invoke-RestMethod -Uri 'https://api.openai.com/v1/models' -Headers @{Authorization=('Bearer ' + $key)} -Method Get
 $models = @($response.data | Where-Object { $_.id -match '^gpt-(6|5)' } | Select-Object -ExpandProperty id | Sort-Object)
 Write-Output ('API authentication succeeded. Available GPT models: ' + ($models -join ', '))
} catch {
 Write-Output 'API access check failed. No key or response body printed.'
 if ($_.Exception.Response) { Write-Output ('HTTP status: ' + [int]$_.Exception.Response.StatusCode) }
 exit 1
} finally {
 $key = $null
 [Array]::Clear($bytes, 0, $bytes.Length)
}
