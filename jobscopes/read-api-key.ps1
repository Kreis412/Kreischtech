param([string]$secretPath)
$ErrorActionPreference = 'Stop'
try {
 Add-Type -AssemblyName System.Security
 if (-not $secretPath) { throw 'Missing key path' }
 $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String([System.IO.File]::ReadAllText($secretPath)), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
 [Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($bytes))
 [Array]::Clear($bytes,0,$bytes.Length)
} catch { [Console]::Error.Write('Cannot unlock the saved API key. Run SETUP_API_KEY again using this Windows account.'); exit 1 }
