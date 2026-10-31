<#
.SYNOPSIS
  Velo Stands - set up the serverless Cosmos DB: account, database, containers.

.DESCRIPTION
  PowerShell version of deploy-cosmos.sh. Deploys cosmos.bicep into an existing
  resource group (default: nag-rg-slotinvaders) and can load the stands file
  into the catalog. Works in Windows PowerShell 5.1 and PowerShell 7.

  Needs the Azure CLI, Contributor rights on the resource group, and Node.js 20+
  for -Sync. Safe to run again: everything is created or updated in place.

.PARAMETER ResourceGroup
  Existing resource group. Default: nag-rg-slotinvaders.
.PARAMETER Location
  Azure region. Default: switzerlandnorth.
.PARAMETER Account
  Cosmos DB account name. Default: velostands-<hash>.
.PARAMETER Subscription
  Subscription name or ID. Default: 1bd6c9df-485a-459f-9a7c-6ce143b7909d.
.PARAMETER Tenant
  Entra ID tenant (directory) of the subscription. Default: 7ec7369b-a72e-427e-a97e-69edbb7df5d9.
  The script signs you in to it if your current login is elsewhere.
.PARAMETER Grant
  Object IDs of more identities that get data access, e.g. the Function App's
  managed identity. Separate several with commas.
.PARAMETER Sync
  Load stands, devices and assignments into the catalog.
.PARAMETER SyncFile
  Stands file for -Sync. Default: stands.yaml next to this script.
.PARAMETER Prune
  With -Sync: also delete catalog entries and area states that are no longer
  in the stands file, e.g. earlier sample data. Not for retiring devices.
.PARAMETER PeriodicBackup
  Periodic backup instead of continuous 7-day.
.PARAMETER NoKeys
  Turn off account keys (Entra ID access only).

.EXAMPLE
  .\deploy-cosmos.ps1 -Sync
.EXAMPLE
  .\deploy-cosmos.ps1 -Sync -SyncFile ..\config\stands.yaml
.EXAMPLE
  .\deploy-cosmos.ps1 -Sync -Prune
.EXAMPLE
  .\deploy-cosmos.ps1 -Grant 11111111-2222-3333-4444-555555555555
#>
[CmdletBinding()]
param(
    [string]$ResourceGroup = 'nag-rg-slotinvaders',
    [string]$Location = 'switzerlandnorth',
    [string]$Account,
    [string]$Subscription = '1bd6c9df-485a-459f-9a7c-6ce143b7909d',
    [string]$Tenant = '7ec7369b-a72e-427e-a97e-69edbb7df5d9',
    [string[]]$Grant = @(),
    [switch]$Sync,
    [string]$SyncFile,
    [switch]$Prune,
    [switch]$PeriodicBackup,
    [switch]$NoKeys
)

$ErrorActionPreference = 'Stop'
$Deployment = 'velostands-cosmos'
$BackupMode = if ($PeriodicBackup) { 'Periodic' } else { 'Continuous7Days' }
if (-not $SyncFile) { $SyncFile = Join-Path $PSScriptRoot 'stands.yaml' }
if ($Prune -and -not $Sync) { throw '-Prune only works together with -Sync.' }

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
if ($Sync) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '-Sync needs Node.js 20 or later.' }
    if (-not (Test-Path -LiteralPath $SyncFile -PathType Leaf)) { throw "File not found: $SyncFile" }
    $SyncFile = (Resolve-Path -LiteralPath $SyncFile).Path
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

# The object ID of whoever is signed in (user or service principal), read from
# an access token for the tenant, so it is the ID that tenant knows.
function Get-CallerObjectId {
    $tokenArgs = @('account', 'get-access-token', '--subscription', $subId, '--query', 'accessToken', '-o', 'tsv')
    $token = Invoke-Az $tokenArgs -AllowFail
    if (-not $token) { return $null }
    try {
        $payload = $token.Split('.')[1].Replace('-', '+').Replace('_', '/')
        switch ($payload.Length % 4) { 2 { $payload += '==' } 3 { $payload += '=' } }
        $claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
        return $claims.oid
    }
    catch {
        return $null
    }
}

if (-not (Invoke-Az 'account', 'show', '--query', 'id', '-o', 'tsv' -AllowFail)) { Connect-Tenant }
$subId = Resolve-Subscription
if (-not $subId) {
    # Signed in elsewhere (another tenant, or a login without this subscription).
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

# The resource group must already exist; this script never creates one.
$rgLocation = Invoke-Az (@('group', 'show', '-n', $ResourceGroup, '--query', 'location', '-o', 'tsv') + $sub) -AllowFail
if (-not $rgLocation) {
    Write-Host "Resource group '$ResourceGroup' was not found in this subscription, or you have no access to it." -ForegroundColor Red
    Write-Host 'Check the name, pick another subscription with -Subscription, or ask for Contributor rights on the group.' -ForegroundColor Red
    exit 1
}
if (-not $Location) { $Location = $rgLocation }
Write-Host "Resource group: $ResourceGroup ($rgLocation)"

# Register Cosmos DB in the subscription if that was never done. Needs
# subscription rights, so only try when it is known to be unregistered.
$regState = Invoke-Az (@('provider', 'show', '-n', 'Microsoft.DocumentDB', '--query', 'registrationState', '-o', 'tsv') + $sub) -AllowFail
if ($regState -eq 'NotRegistered' -or $regState -eq 'Unregistered') {
    Write-Step 'Registering the Cosmos DB resource provider (one-time per subscription)'
    & az provider register -n Microsoft.DocumentDB --wait --subscription $subId
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Could not register it. Ask a subscription owner to register Microsoft.DocumentDB.' }
}

# --- Who gets data access ----------------------------------------------------
# The caller (a user, or a service principal in CI) plus any -Grant IDs.
$callerId = Get-CallerObjectId
if (-not $callerId) {
    Write-Warning "Couldn't read your object ID, so you won't get data access. Run again with -Grant <your object ID>."
}
$principals = @(@($Grant) + @($callerId) | Where-Object { $_ } | Sort-Object -Unique)

# --- Deploy ------------------------------------------------------------------
# Parameters go through a file, so no JSON quoting is needed on the command line.
$parameters = [ordered]@{
    location                    = @{ value = $Location }
    backupMode                  = @{ value = $BackupMode }
    disableKeyAuth              = @{ value = [bool]$NoKeys }
    dataContributorPrincipalIds = @{ value = $principals }
}
if ($Account) { $parameters['accountName'] = @{ value = $Account } }
$parameterJson = [ordered]@{
    '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion = '1.0.0.0'
    parameters     = $parameters
} | ConvertTo-Json -Depth 5
$parameterFile = Join-Path ([IO.Path]::GetTempPath()) "velostands-cosmos-$PID.parameters.json"
[IO.File]::WriteAllText($parameterFile, $parameterJson)

Write-Step "Cosmos DB account, database and containers in $Location (a new account takes a few minutes)"
$deployArgs = @(
    'deployment', 'group', 'create',
    '-g', $ResourceGroup,
    '-n', $Deployment,
    '--template-file', (Join-Path $PSScriptRoot 'cosmos.bicep'),
    '--parameters', "@$parameterFile",
    '-o', 'none'
) + $sub
try {
    Invoke-Az $deployArgs | Out-Null
}
finally {
    Remove-Item -LiteralPath $parameterFile -ErrorAction SilentlyContinue
}

function Get-DeploymentOutput([string]$Name) {
    Invoke-Az (@('deployment', 'group', 'show', '-g', $ResourceGroup, '-n', $Deployment, '--query', "properties.outputs.$Name.value", '-o', 'tsv') + $sub)
}
$accountName = Get-DeploymentOutput 'accountName'
$endpoint = Get-DeploymentOutput 'endpoint'
$database = Get-DeploymentOutput 'databaseName'

# --- Optional catalog sync ---------------------------------------------------
if ($Sync) {
    Write-Step "Loading $(Split-Path -Leaf $SyncFile) into the catalog"
    $npm = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
    Push-Location $PSScriptRoot
    try {
        & $npm install --no-audit --no-fund --loglevel=error
        if ($LASTEXITCODE -ne 0) { throw 'Installing the sync dependencies failed.' }
    }
    finally {
        Pop-Location
    }
    $env:COSMOS_ENDPOINT = $endpoint
    $env:COSMOS_DATABASE = $database
    $syncArgs = @((Join-Path $PSScriptRoot 'sync-catalog.mjs'), $SyncFile)
    if ($Prune) { $syncArgs += '--prune' }
    & node @syncArgs
    if ($LASTEXITCODE -ne 0) { throw 'The catalog sync failed.' }
}

# --- Summary -----------------------------------------------------------------
Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host "  Tenant          $Tenant"
Write-Host "  Subscription    $subName ($subId)"
Write-Host "  Resource group  $ResourceGroup"
Write-Host "  Account         $accountName (serverless, $Location, backup: $BackupMode)"
Write-Host "  Endpoint        $endpoint"
Write-Host "  Database        $database"
Write-Host '  Containers      catalog, readings (events expire after 30 days), state, rollups'
Write-Host ''
Write-Host 'Function App settings:'
Write-Host "  COSMOS_ENDPOINT=$endpoint"
Write-Host "  COSMOS_DATABASE=$database"
Write-Host ''
Write-Host "Give the Function App's managed identity data access:"
Write-Host "  .\deploy-cosmos.ps1 -ResourceGroup $ResourceGroup -Account $accountName -Grant <principal-id>"
if (-not $NoKeys) {
    Write-Host ''
    Write-Host 'Connection string, only if you use keys instead of an identity:'
    Write-Host "  az cosmosdb keys list --subscription $subId -g $ResourceGroup -n $accountName --type connection-strings --query connectionStrings[0].connectionString -o tsv"
}
