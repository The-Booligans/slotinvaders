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
    # Pre-flight: fail fast if the local checkout is obviously broken, before we
    # overwrite the live site with an empty package.
    foreach ($required in 'host.json', 'package.json') {
        if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $required))) {
            throw "Expected $required is missing from $PSScriptRoot. Check your checkout before deploying."
        }
    }
    $sourceFunctions = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src/functions') -Filter *.js -File -ErrorAction SilentlyContinue)
    if ($sourceFunctions.Count -eq 0) {
        throw "No functions found under src/functions. The resulting package would deploy an empty Function App."
    }
    Write-Host ("Functions to deploy ({0}): {1}" -f $sourceFunctions.Count, (($sourceFunctions | ForEach-Object { $_.BaseName }) -join ', '))

    # Unresolved git merge markers in any .js file crash the Function host at
    # load, which is how the live app ended up with zero routes once already.
    $conflicted = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src') -Recurse -Filter *.js -File |
        Select-String -SimpleMatch -Pattern '<<<<<<<', '=======', '>>>>>>>' -List |
        ForEach-Object { $_.Path })
    if ($conflicted.Count -gt 0) {
        $prefix = $PSScriptRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
        $relative = $conflicted | ForEach-Object {
            if ($_.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { $_.Substring($prefix.Length) } else { $_ }
        }
        throw "Unresolved merge conflict markers found in: $($relative -join ', '). Resolve them before deploying."
    }

    # Even without markers a file can still throw at module load (bad require,
    # typo, missing dep). Require each function file the same way the Azure
    # Functions host does; a throw here is a 404-on-every-route in prod.
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) { $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue }
    $nodeExe = if ($nodeCmd) { $nodeCmd.Source } else { $null }
    if ($nodeExe) {
        $funcDir = Join-Path $PSScriptRoot 'src/functions'
        $loadScript = "const fs=require('fs'),path=require('path');const d=process.argv[1];for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.js'))){try{require(path.join(d,f));}catch(e){console.error(f+': '+(e.message||e));process.exitCode=1;}}"
        & $nodeExe -e $loadScript $funcDir
        if ($LASTEXITCODE -ne 0) {
            throw "One or more function modules failed to load. Fix the errors above before deploying."
        }
    } else {
        Write-Warning 'node not on PATH; skipping the module-load smoke test.'
    }

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

        # Without the Azure Functions SDK the host loads zero routes and every
        # request returns 404. Catching this here beats finding out from a 404
        # in production.
        $requiredDeps = @('@azure/functions', '@azure/cosmos', '@azure/identity')
        foreach ($dep in $requiredDeps) {
            $depPackage = Join-Path $staging "node_modules/$dep/package.json"
            if (-not (Test-Path -LiteralPath $depPackage)) {
                throw "Required dependency '$dep' is missing from the staged package. The deploy would brick the Function App."
            }
        }
        $stagedFunctions = @(Get-ChildItem -LiteralPath (Join-Path $staging 'src/functions') -Filter *.js -File)
        if ($stagedFunctions.Count -ne $sourceFunctions.Count) {
            throw "Staged function count ($($stagedFunctions.Count)) does not match the source ($($sourceFunctions.Count))."
        }

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::CreateFromDirectory($staging, $zip)
        $sizeBytes = (Get-Item -LiteralPath $zip).Length
        $sizeMb = [math]::Round($sizeBytes / 1MB, 1)
        Write-Host "Package: $sizeMb MB"
        # A healthy package is well above 1 MB once @azure/* is included. A
        # tiny zip means npm install produced nothing useful.
        if ($sizeBytes -lt 1MB) {
            throw "Package is only $sizeMb MB; expected at least 1 MB. Refusing to deploy an incomplete build."
        }

        Write-Step "Deploying the code to $appNameOut"
        Invoke-Az (@('functionapp', 'deployment', 'source', 'config-zip', '-g', $ResourceGroup, '-n', $appNameOut, '--src', $zip, '-o', 'none') + $sub) | Out-Null
    }
    finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    }

    # Post-deploy smoke test: a cold start can take up to ~60 s, so poll a known
    # public route and fail loudly if the host never serves anything but 404.
    Write-Step 'Smoke test: GET /api/v1/stands'
    $smokeUrl = "https://$hostName/api/v1/stands"
    $deadline = (Get-Date).AddSeconds(120)
    $smokeStatus = 0
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $smokeUrl -Method Get -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
            $smokeStatus = [int]$response.StatusCode
        } catch {
            $smokeStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        }
        if ($smokeStatus -ne 0 -and $smokeStatus -ne 404) { break }
        Start-Sleep -Seconds 5
    }
    if ($smokeStatus -eq 0) {
        Write-Warning "Smoke test could not reach $smokeUrl. Check the Function App's Log stream."
    } elseif ($smokeStatus -eq 404) {
        Write-Host "Smoke test: HTTP 404 after 120 s — host is up but no routes are registered." -ForegroundColor Red
        throw "Deploy appears to have left the Function App without functions. Inspect Log stream and Application Insights."
    } else {
        Write-Host "Smoke test: HTTP $smokeStatus — routes are serving." -ForegroundColor Green
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
