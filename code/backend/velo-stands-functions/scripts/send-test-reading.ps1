<#
.SYNOPSIS
  Sends one test reading to the Velo Stands API, like a device would.

.EXAMPLE
  ./scripts/send-test-reading.ps1 -Url https://<app>.azurewebsites.net/api/v1/readings -Key vs_... -Occupied 9

.EXAMPLE
  ./scripts/send-test-reading.ps1 -Url http://localhost:7071/api/v1/readings -Key vs_... -Occupied 3
#>
param(
    [Parameter(Mandatory)][string]$Url,
    [Parameter(Mandatory)][string]$Key,
    [int]$Occupied = 5,
    # Seconds since 1970, so every run sends a higher seq than the one before.
    [long]$Seq = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(),
    [string]$Firmware = 'test',
    [int]$Rssi = -60
)

$body = [ordered]@{
    occupied   = $Occupied
    seq        = $Seq
    measuredAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss'Z'")
    fw         = $Firmware
    rssi       = $Rssi
} | ConvertTo-Json -Compress

Write-Host "POST $Url"
Write-Host "     $body"
try {
    $response = Invoke-WebRequest -Method Post -Uri $Url -Headers @{ 'X-Api-Key' = $Key } `
        -ContentType 'application/json' -Body $body -UseBasicParsing
    Write-Host "<- $([int]$response.StatusCode) $($response.Content)" -ForegroundColor Green
}
catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'no response' }
    Write-Host "<- $status $($_.ErrorDetails.Message)" -ForegroundColor Red
}
