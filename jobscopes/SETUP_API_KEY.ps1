param([switch]$SelfTest)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
function Protect-KeyBytes([byte[]]$bytes) {
    return [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
}
if ($SelfTest) {
    $sample = [System.Text.Encoding]::UTF8.GetBytes('synthetic-test-only')
    $protected = Protect-KeyBytes $sample
    $restored = [System.Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    if ([System.Text.Encoding]::UTF8.GetString($restored) -ne 'synthetic-test-only') { throw 'Encryption test failed.' }
    Write-Host 'Windows encryption round-trip passed. No key read or saved.'
    exit 0
}
$privateDirectory = Join-Path $PSScriptRoot 'data'
$secretPath = Join-Path $privateDirectory 'openai-key.dpapi'
Write-Host 'ContractorSight API key setup'
Write-Host 'Paste your OpenAI key below. It will be hidden and encrypted for this Windows account.'
$apiSecret = Read-Host 'OpenAI API key' -AsSecureString
$pointer = [IntPtr]::Zero
$plainBytes = $null
try {
    if ($apiSecret.Length -lt 20) { throw 'No valid key entered. Nothing saved.' }
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiSecret)
    $plainText = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if (-not $plainText.StartsWith('sk-')) { throw 'Expected an OpenAI key starting with sk-. Nothing saved.' }
    $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($plainText)
    $plainText = $null
    $encryptedBytes = Protect-KeyBytes $plainBytes
    [System.IO.Directory]::CreateDirectory($privateDirectory) | Out-Null
    [System.IO.File]::WriteAllText($secretPath, [Convert]::ToBase64String($encryptedBytes))
} finally {
    if ($plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
    if ($pointer -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $plainText = $null
    $apiSecret.Dispose()
}
Write-Host 'Key saved privately. No API request was made and no credits were spent.'
Read-Host 'Press Enter to close'
