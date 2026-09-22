Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class ContractorSightAwake { [DllImport("kernel32.dll", SetLastError=true)] public static extern uint SetThreadExecutionState(uint flags); }'
$result = [ContractorSightAwake]::SetThreadExecutionState([uint32]2147483649)
if ($result -eq 0) { throw 'Windows did not accept the temporary keep-awake request.' }
Write-Output 'Temporary system keep-awake active for up to one hour. Display and lock settings unchanged.'
try { Start-Sleep -Seconds 3600 }
finally { [ContractorSightAwake]::SetThreadExecutionState([uint32]2147483648) | Out-Null }
