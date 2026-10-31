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
#   -t, --tenant ID            Entra ID tenant of the subscription; you are signed in
#                              to it if needed (default: 7ec7369b-a72e-427e-a97e-69edbb7df5d9)
#       --grant OBJECT_ID      Give another identity data access, e.g. the Function
#                              App's managed identity. Repeatable.
#       --sync [FILE]          Load stands, devices and assignments into the catalog
#                              (default file: stands.yaml next to this script)
#       --prune                With --sync: also delete catalog entries and area states
#                              that are no longer in the file (e.g. sample data)
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
TENANT="7ec7369b-a72e-427e-a97e-69edbb7df5d9"
GRANTS=()
DO_SYNC=false
SYNC_FILE="$SCRIPT_DIR/stands.yaml"
PRUNE=false
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
    -t|--tenant)         TENANT="${2:?$1 needs a value}"; shift 2 ;;
    --grant)             GRANTS+=("${2:?$1 needs an object ID}"); shift 2 ;;
    --sync)
      DO_SYNC=true
      if [[ $# -gt 1 && "$2" != -* ]]; then SYNC_FILE="$2"; shift 2; else shift; fi ;;
    --prune)             PRUNE=true; shift ;;
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
if $PRUNE && ! $DO_SYNC; then
  echo "--prune only works together with --sync." >&2
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

# --- Sign-in: tenant and subscription -----------------------------------------
# Every call below names the subscription explicitly, so the script never
# depends on (or changes) the default subscription of your az login.

connect_tenant() {
  local login=(login -o none)
  if [[ -n "$TENANT" ]]; then login+=(--tenant "$TENANT"); fi
  step "Signing in to tenant $TENANT"
  az "${login[@]}"
}

# Prints the subscription ID if this login can see it in the right tenant.
resolve_subscription() {
  local query=(account show --query "[id, tenantId]" -o tsv) found id tenant_id
  if [[ -n "$SUBSCRIPTION" ]]; then query+=(--subscription "$SUBSCRIPTION"); fi
  found="$(az "${query[@]}" 2>/dev/null | tr -d '\r')" || return 0
  read -r id tenant_id <<<"$found"
  if [[ -n "$TENANT" && "$tenant_id" != "$TENANT" ]]; then return 0; fi
  printf '%s' "$id"
}

# The object ID of whoever is signed in (user or service principal), read from
# an access token for the subscription's tenant, so it is the ID that tenant knows.
caller_object_id() {
  local payload
  payload="$(az account get-access-token "${SUB[@]}" --query accessToken -o tsv 2>/dev/null | tr -d '\r' | cut -d. -f2 | tr '_-' '/+')" || return 0
  case $(( ${#payload} % 4 )) in 2) payload="$payload==" ;; 3) payload="$payload=" ;; esac
  printf '%s' "$payload" | base64 -d 2>/dev/null | sed -n 's/.*"oid" *: *"\([^"]*\)".*/\1/p' || true
}

az account show -o none 2>/dev/null || connect_tenant
SUB_ID="$(resolve_subscription)"
if [[ -z "$SUB_ID" ]]; then
  # Signed in elsewhere (another tenant, or a login without this subscription).
  connect_tenant
  SUB_ID="$(resolve_subscription)"
fi
if [[ -z "$SUB_ID" ]]; then
  echo "Subscription \"$SUBSCRIPTION\" was not found in tenant \"$TENANT\" for this login." >&2
  echo "Run 'az account list -o table' to see what you can reach, and check both IDs." >&2
  exit 1
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
CALLER_ID="$(caller_object_id)"
if [[ -n "$CALLER_ID" ]]; then
  GRANTS+=("$CALLER_ID")
else
  echo "Warning: couldn't read your object ID, so you won't get data access. Run again with --grant <your object ID>." >&2
fi

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
  SYNC_ARGS=("$SYNC_FILE")
  if $PRUNE; then SYNC_ARGS+=(--prune); fi
  COSMOS_ENDPOINT="$ENDPOINT" COSMOS_DATABASE="$DATABASE" \
    node "$SCRIPT_DIR/sync-catalog.mjs" "${SYNC_ARGS[@]}"
fi

# --- Summary -----------------------------------------------------------------
cat <<SUMMARY

Done.
  Tenant          $TENANT
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
