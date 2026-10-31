#!/usr/bin/env bash
# Velo Stands – set up the serverless Cosmos DB: account, database, containers.
# Deploys into an existing resource group (default: nag-rg-slotinvaders).
#
# Usage: ./deploy-cosmos.sh [options]
#
#   -g, --resource-group NAME  Existing resource group (default: nag-rg-slotinvaders)
#   -l, --location REGION      Azure region (default: switzerlandnorth)
#   -n, --account NAME         Cosmos DB account name (default: velostands-<hash>)
#   -s, --subscription ID      Subscription (default: 1bd6c9df-485a-459f-9a7c-6ce143b7909d)
#       --grant OBJECT_ID      Give another identity data access, e.g. the Function
#                              App's managed identity. Repeatable.
#       --sync [FILE]          Load stands, devices and assignments into the catalog
#                              (default file: stands.sample.yaml next to this script)
#       --periodic-backup      Periodic backup instead of continuous 7-day
#       --no-keys              Turn off account keys (Entra ID access only)
#   -h, --help                 Show this help
#
# Needs the Azure CLI, Contributor rights on the resource group, and Node.js 20+
# for --sync. Azure Cloud Shell has the tools.
# Safe to run again: everything is created or updated in place.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RG="nag-rg-slotinvaders"
LOCATION="switzerlandnorth"
ACCOUNT=""
SUBSCRIPTION="1bd6c9df-485a-459f-9a7c-6ce143b7909d"
GRANTS=()
DO_SYNC=false
SYNC_FILE="$SCRIPT_DIR/stands.sample.yaml"
BACKUP_MODE="Continuous7Days"
DISABLE_KEYS=false
DEPLOYMENT="velostands-cosmos"

usage() { awk 'NR > 2 && /^#/ { sub(/^# ?/, ""); print; next } NR > 2 { exit }' "${BASH_SOURCE[0]}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -g|--resource-group) RG="${2:?$1 needs a value}"; shift 2 ;;
    -l|--location)       LOCATION="${2:?$1 needs a value}"; shift 2 ;;
    -n|--account)        ACCOUNT="${2:?$1 needs a value}"; shift 2 ;;
    -s|--subscription)   SUBSCRIPTION="${2:?$1 needs a value}"; shift 2 ;;
    --grant)             GRANTS+=("${2:?$1 needs an object ID}"); shift 2 ;;
    --sync)
      DO_SYNC=true
      if [[ $# -gt 1 && "$2" != -* ]]; then SYNC_FILE="$2"; shift 2; else shift; fi ;;
    --periodic-backup)   BACKUP_MODE="Periodic"; shift ;;
    --no-keys)           DISABLE_KEYS=true; shift ;;
    -h|--help)           usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }

# --- Prerequisites -----------------------------------------------------------
if ! command -v az >/dev/null 2>&1; then
  echo "The Azure CLI is missing. Install it (https://aka.ms/installazurecli) or use Azure Cloud Shell." >&2
  exit 1
fi
if $DO_SYNC && ! command -v node >/dev/null 2>&1; then
  echo "--sync needs Node.js 20 or later." >&2
  exit 1
fi
if $DO_SYNC && [[ ! -f "$SYNC_FILE" ]]; then
  echo "File not found: $SYNC_FILE" >&2
  exit 1
fi

az account show -o none 2>/dev/null || az login -o none
# Every call below names the subscription explicitly, so the script never
# depends on (or changes) the default subscription of your az login.
if [[ -n "$SUBSCRIPTION" ]]; then
  SUB_ID="$(az account show --subscription "$SUBSCRIPTION" --query id -o tsv 2>/dev/null || true)"
  if [[ -z "$SUB_ID" ]]; then
    echo "Your Azure login can't see subscription \"$SUBSCRIPTION\"." >&2
    echo "Run 'az account list -o table' to see the ones it can. If the subscription belongs to another directory, sign in there with 'az login --tenant <tenant-id>' and run the script again." >&2
    exit 1
  fi
else
  SUB_ID="$(az account show --query id -o tsv)"
fi
SUB=(--subscription "$SUB_ID")
SUB_NAME="$(az account show "${SUB[@]}" --query name -o tsv)"
echo "Subscription: $SUB_NAME ($SUB_ID)"

# The resource group must already exist; this script never creates one.
RG_LOCATION="$(az group show "${SUB[@]}" -n "$RG" --query location -o tsv 2>/dev/null || true)"
if [[ -z "$RG_LOCATION" ]]; then
  echo "Resource group \"$RG\" was not found in this subscription, or you have no access to it." >&2
  echo "Check the name, pick another subscription with -s, or ask for Contributor rights on the group." >&2
  exit 1
fi
LOCATION="${LOCATION:-$RG_LOCATION}"
echo "Resource group: $RG ($RG_LOCATION)"

# Register Cosmos DB in the subscription if that was never done. Needs
# subscription rights, so only try when it is known to be unregistered.
REG_STATE="$(az provider show "${SUB[@]}" -n Microsoft.DocumentDB --query registrationState -o tsv 2>/dev/null || true)"
if [[ "$REG_STATE" == "NotRegistered" || "$REG_STATE" == "Unregistered" ]]; then
  step "Registering the Cosmos DB resource provider (one-time per subscription)"
  az provider register "${SUB[@]}" -n Microsoft.DocumentDB --wait \
    || echo "Could not register it. Ask a subscription owner to register Microsoft.DocumentDB." >&2
fi

# --- Who gets data access ----------------------------------------------------
# The caller (a user, or a service principal in CI) plus any --grant IDs.
CALLER_TYPE="$(az account show "${SUB[@]}" --query user.type -o tsv)"
if [[ "$CALLER_TYPE" == "user" ]]; then
  CALLER_ID="$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)"
else
  CALLER_ID="$(az ad sp show --id "$(az account show "${SUB[@]}" --query user.name -o tsv)" --query id -o tsv 2>/dev/null || true)"
fi
if [[ -n "$CALLER_ID" ]]; then GRANTS+=("$CALLER_ID"); fi

PRINCIPALS="[]"
if [[ ${#GRANTS[@]} -gt 0 ]]; then
  PRINCIPALS="[$(printf '%s\n' "${GRANTS[@]}" | sort -u | sed 's/.*/"&"/' | tr '\n' ',' | sed 's/,$//')]"
fi

# --- Deploy ------------------------------------------------------------------
PARAMS=(
  "location=$LOCATION"
  "backupMode=$BACKUP_MODE"
  "disableKeyAuth=$DISABLE_KEYS"
  "dataContributorPrincipalIds=$PRINCIPALS"
)
if [[ -n "$ACCOUNT" ]]; then PARAMS+=("accountName=$ACCOUNT"); fi

step "Cosmos DB account, database and containers in $LOCATION (a new account takes a few minutes)"
az deployment group create "${SUB[@]}" \
  -g "$RG" -n "$DEPLOYMENT" \
  --template-file "$SCRIPT_DIR/cosmos.bicep" \
  --parameters "${PARAMS[@]}" \
  -o none

output() { az deployment group show "${SUB[@]}" -g "$RG" -n "$DEPLOYMENT" --query "properties.outputs.$1.value" -o tsv; }
ACCOUNT_NAME="$(output accountName)"
ENDPOINT="$(output endpoint)"
DATABASE="$(output databaseName)"

# --- Optional catalog sync ---------------------------------------------------
if $DO_SYNC; then
  step "Loading $(basename "$SYNC_FILE") into the catalog"
  (cd "$SCRIPT_DIR" && npm install --no-audit --no-fund --loglevel=error)
  COSMOS_ENDPOINT="$ENDPOINT" COSMOS_DATABASE="$DATABASE" \
    node "$SCRIPT_DIR/sync-catalog.mjs" "$SYNC_FILE"
fi

# --- Summary -----------------------------------------------------------------
cat <<SUMMARY

Done.
  Subscription    $SUB_NAME ($SUB_ID)
  Resource group  $RG
  Account         $ACCOUNT_NAME (serverless, $LOCATION, backup: $BACKUP_MODE)
  Endpoint        $ENDPOINT
  Database        $DATABASE
  Containers      catalog, readings (events expire after 30 days), state, rollups

Function App settings:
  COSMOS_ENDPOINT=$ENDPOINT
  COSMOS_DATABASE=$DATABASE

Give the Function App's managed identity data access:
  ./deploy-cosmos.sh -g $RG -n $ACCOUNT_NAME --grant <principal-id>
SUMMARY
if ! $DISABLE_KEYS; then
  cat <<KEYS

Connection string, only if you use keys instead of an identity:
  az cosmosdb keys list --subscription $SUB_ID -g $RG -n $ACCOUNT_NAME --type connection-strings --query "connectionStrings[0].connectionString" -o tsv
KEYS
fi
