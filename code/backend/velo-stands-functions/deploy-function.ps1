<#
.SYNOPSIS
  Velo Stands - create the Function App and deploy the device API to it.

.DESCRIPTION
  1. Creates (or updates) the Function App from function.bicep: Consumption plan
     on Windows, storage account, Application Insights with a daily log cap,
     and read/write access to the Cosmos DB for the app's managed identity.
  2. Packages the code (host.json, package.json, src/ plus production
     dependencies) and deploys it.

  Run deploy-cosmos.ps1 first: this script looks up the Cosmos DB account it
  created. Needs the Azure CLI and Node.js 22 (npm) for packaging. Works in
  Windows PowerShell 5.1 and PowerShell 7, locally or in Azure Cloud Shell.
  Safe to run again.

.PARAMETER ResourceGroup
  Existing resource group. Default: nag-rg-slotinvaders.
.PARAMETER Location
  Azure region. Default: switzerlandnorth.
.PARAMETER Subscription
  Subscription name or ID. Default: 1bd6c9df-485a-459f-9a7c-6ce143b7909d.
.PARAMETER Tenant
  Entra ID tenant of the subscription. Default: 7ec7369b-a72e-427e-a97e-69edbb7df5d9.
.PARAMETER AppName
  Function App name. Default: func-velostands-<hash>.
.PARAMETER CosmosAccount
  Cosmos DB account name. Default: the one created by deploy-cosmos.ps1.
.PARAMETER QuietLogs
  One log line per request instead of every step.
.PARAMETER SkipInfra
  Only deploy the code.
.PARAMETER SkipCode
  Only create or update the Azure resources.

.EXAMPLE
  ./deploy-function.ps1
.EXAMPLE
  ./deploy-function.ps1 -SkipInfra
#>
[CmdletBinding()]
param(
    [string]$ResourceGroup = 'nag-rg-slotinvaders',
    [string]$Location = 'switzerlandnorth',
    [string]$Subscription = '1bd6c9df-485a-459f-9a7c-6ce143b7909d',
    [string]$Tenant = '7ec7369b-a72e-427e-a97e-69edbb7df5d9',
    [string]$AppName,
    [string]$CosmosAccount,
    [string]$CosmosDatabase = 'velostands',
    [switch]$QuietLogs,
    [switch]$SkipInfra,
    [switch]$SkipCode
)

$ErrorActionPreference = 'Stop'
$Deployment = 'velostands-function'

function Write-Step([string]$Text) {
    Write-Host ''
    Write-Host "==> $Text" -ForegroundColor Cyan
}

# Runs the Azure CLI and returns its output as trimmed text. Stops the script
# if az fails, unless -AllowFail is set; then it returns $null.
function Invoke-Az {
    param([string[]]$Arguments, [switch]$AllowFail)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'   # az writes progress and warnings to stderr
    try {
        if ($AllowFail) { $out = & az @Arguments 2>$null } else { $out = & az @Arguments }
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }
    if ($code -ne 0) {
        if ($AllowFail) { return $null }
        throw "This Azure CLI call failed: az $($Arguments -join ' ')"
    }
    if ($null -eq $out) { return $null }
    return ($out | Out-String).Trim()
}

# --- Prerequisites -----------------------------------------------------------
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw 'The Azure CLI is missing. Install it from https://aka.ms/installazurecli or use Azure Cloud Shell.'
}
$npm = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
if (-not $SkipCode -and -not (Get-Command $npm -ErrorAction SilentlyContinue)) {
    throw 'Packaging the code needs Node.js 22 with npm (winget install OpenJS.NodeJS.LTS), or run with -SkipCode.'
}

# --- Sign-in: tenant and subscription -----------------------------------------
# Every call below names the subscription explicitly, so the script never
# depends on (or changes) the default subscription of your az login.

function Connect-Tenant {
    $loginArgs = @('login', '-o', 'none')
    if ($Tenant) { $loginArgs += @('--tenant', $Tenant) }
    Write-Step "Signing in to tenant $Tenant"
    Invoke-Az $loginArgs | Out-Null
}

# Returns the subscription ID if this login can see it in the right tenant, else $null.
function Resolve-Subscription {
    $query = @('account', 'show', '--query', '[id, tenantId]', '-o', 'tsv')
    if ($Subscription) { $query += @('--subscription', $Subscription) }
    $found = Invoke-Az $query -AllowFail
    if (-not $found) { return $null }
    $id, $tenantId = $found -split '\s+'
    if ($Tenant -and $tenantId -ne $Tenant) { return $null }
    return $id
}

if (-not (Invoke-Az 'account', 'show', '--query', 'id', '-o', 'tsv' -AllowFail)) { Connect-Tenant }
$subId = Resolve-Subscription
if (-not $subId) {
    Connect-Tenant
    $subId = Resolve-Subscription
}
if (-not $subId) {
    Write-Host "Subscription '$Subscription' was not found in tenant '$Tenant' for this login." -ForegroundColor Red
    Write-Host "Run 'az account list -o table' to see what you can reach, and check both IDs." -ForegroundColor Red
    exit 1
}
$sub = @('--subscription', $subId)
$subName = Invoke-Az (@('account', 'show', '--query', 'name', '-o', 'tsv') + $sub)
Write-Host "Subscription: $subName ($subId)"

$rgLocation = Invoke-Az (@('group', 'show', '-n', $ResourceGroup, '--query', 'location', '-o', 'tsv') + $sub) -AllowFail
if (-not $rgLocation) {
    Write-Host "Resource group '$ResourceGroup' was not found in this subscription, or you have no access to it." -ForegroundColor Red
    exit 1
}
Write-Host "Resource group: $ResourceGroup"

# --- Cosmos DB account ---------------------------------------------------------
if (-not $CosmosAccount) {
    $CosmosAccount = Invoke-Az (@('deployment', 'group', 'show', '-g', $ResourceGroup, '-n', 'velostands-cosmos', '--query', 'properties.outputs.accountName.value', '-o', 'tsv') + $sub) -AllowFail
}
if (-not $CosmosAccount) {
    $CosmosAccount = Invoke-Az (@('cosmosdb', 'list', '-g', $ResourceGroup, '--query', '[0].name', '-o', 'tsv') + $sub) -AllowFail
}
if (-not $CosmosAccount) {
    Write-Host "No Cosmos DB account found in '$ResourceGroup'. Run deploy-cosmos.ps1 first, or pass -CosmosAccount." -ForegroundColor Red
    exit 1
}
Write-Host "Cosmos DB account: $CosmosAccount"

# --- Azure resources -------------------------------------------------------------
if (-not $SkipInfra) {
    foreach ($provider in 'Microsoft.Web', 'Microsoft.Storage', 'Microsoft.Insights', 'Microsoft.OperationalInsights') {
        $state = Invoke-Az (@('provider', 'show', '-n', $provider, '--query', 'registrationState', '-o', 'tsv') + $sub) -AllowFail
        if ($state -eq 'NotRegistered' -or $state -eq 'Unregistered') {
            Write-Step "Registering the $provider resource provider (one-time per subscription)"
            & az provider register -n $provider --wait --subscription $subId
            if ($LASTEXITCODE -ne 0) { Write-Warning "Could not register $provider. Ask a subscription owner to register it." }
        }
    }

    $parameters = [ordered]@{
        location           = @{ value = $Location }
        cosmosAccountName  = @{ value = $CosmosAccount }
        cosmosDatabaseName = @{ value = $CosmosDatabase }
        debugLogging       = @{ value = (-not $QuietLogs) }
    }
    if ($AppName) { $parameters['appName'] = @{ value = $AppName } }
    $parameterJson = [ordered]@{
        '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters     = $parameters
    } | ConvertTo-Json -Depth 5
    $parameterFile = Join-Path ([IO.Path]::GetTempPath()) "velostands-function-$PID.parameters.json"
    [IO.File]::WriteAllText($parameterFile, $parameterJson)

    Write-Step "Function App, storage and Application Insights in $Location"
    $deployArgs = @(
        'deployment', 'group', 'create',
        '-g', $ResourceGroup,
        '-n', $Deployment,
        '--template-file', (Join-Path $PSScriptRoot 'function.bicep'),
        '--parameters', "@$parameterFile",
        '-o', 'none'
    ) + $sub
    try {
        Invoke-Az $deployArgs | Out-Null
    }
    finally {
        Remove-Item -LiteralPath $parameterFile -ErrorAction SilentlyContinue
    }
}

function Get-DeploymentOutput([string]$Name) {
    Invoke-Az (@('deployment', 'group', 'show', '-g', $ResourceGroup, '-n', $Deployment, '--query', "properties.outputs.$Name.value", '-o', 'tsv') + $sub) -AllowFail
}
$appNameOut = Get-DeploymentOutput 'appName'
$readingsUrl = Get-DeploymentOutput 'readingsUrl'
$hostName = Get-DeploymentOutput 'hostName'
$insightsName = Get-DeploymentOutput 'insightsName'
if (-not $appNameOut) {
    Write-Host "No Function App deployment found in '$ResourceGroup'. Run the script once without -SkipInfra." -ForegroundColor Red
    exit 1
}

# --- Code ----------------------------------------------------------------------
if (-not $SkipCode) {
    Write-Step 'Packaging the code'
    $staging = Join-Path ([IO.Path]::GetTempPath()) "velostands-function-$PID"
    $zip = "$staging.zip"
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $staging | Out-Null
    try {
        Copy-Item -Path (Join-Path $PSScriptRoot 'host.json'), (Join-Path $PSScriptRoot 'package.json') -Destination $staging
        $lockFile = Join-Path $PSScriptRoot 'package-lock.json'
        if (Test-Path -LiteralPath $lockFile) { Copy-Item -LiteralPath $lockFile -Destination $staging }
        Copy-Item -Path (Join-Path $PSScriptRoot 'src') -Destination $staging -Recurse

        Push-Location $staging
        try {
            & $npm install --omit=dev --no-audit --no-fund --loglevel=error
            if ($LASTEXITCODE -ne 0) { throw 'Installing the production dependencies failed.' }
        }
        finally {
            Pop-Location
        }

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::CreateFromDirectory($staging, $zip)
        $sizeMb = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)
        Write-Host "Package: $sizeMb MB"

        Write-Step "Deploying the code to $appNameOut"
        Invoke-Az (@('functionapp', 'deployment', 'source', 'config-zip', '-g', $ResourceGroup, '-n', $appNameOut, '--src', $zip, '-o', 'none') + $sub) | Out-Null
    }
    finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    }
}

# --- Summary -------------------------------------------------------------------
Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host "  Function App   $appNameOut (Consumption plan, Windows, Node.js 22)"
Write-Host "  Device API     POST $readingsUrl"
Write-Host "  Stand status   GET  https://$hostName/api/v1/stands   (public, no key)"
Write-Host "  Logs           Application Insights '$insightsName' (daily cap 0.15 GB)"
Write-Host ''
Write-Host 'Send a test reading (needs a device key whose hash is in the catalog, see README):'
Write-Host "  ./scripts/send-test-reading.ps1 -Url $readingsUrl -Key <device-key> -Occupied 9"
Write-Host ''
Write-Host 'Watch the function log live: Azure portal > Function App > Log stream,'
Write-Host 'or query it in Application Insights > Logs:'
Write-Host '  traces | where message startswith "[readings" | order by timestamp desc'
