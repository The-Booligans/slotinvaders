// Velo Stands – Cosmos DB for NoSQL, serverless
//
// Creates the account, one database and the four containers of the data model:
//
//   container  holds                                             partition key  expiry
//   ---------  ------------------------------------------------  -------------  -------------
//   catalog    site, areas, stands, devices, device assignments  /siteId        never
//   readings   occupancy events, append-only                     /standId       readingTtlDays
//   state      latest count per device, one document per area    /areaId        never
//   rollups    hourly occupancy per stand, for weekday trends    /standId       never
//
// Cheapest setup: serverless (pay per request, no minimum), one region, no
// availability zones, continuous 7-day backup (no backup storage charge).
//
// Deploy with deploy-cosmos.sh, or directly:
//   az deployment group create -g nag-rg-slotinvaders --template-file cosmos.bicep

targetScope = 'resourceGroup'

@description('Azure region. A serverless account lives in exactly one region, and regions cannot be added later.')
param location string = resourceGroup().location

@description('Globally unique account name: 3-44 characters, lowercase letters, digits and hyphens.')
@minLength(3)
@maxLength(44)
param accountName string = 'velostands-${uniqueString(resourceGroup().id)}'

@description('Name of the database.')
param databaseName string = 'velostands'

@description('Days to keep raw occupancy events in "readings". Keep it equal to settings.readingTtlDays in stands.yaml.')
@minValue(1)
@maxValue(365)
param readingTtlDays int = 30

@description('Continuous7Days gives point-in-time restore with no backup storage charge. Periodic is the fallback.')
@allowed([
  'Continuous7Days'
  'Periodic'
])
param backupMode string = 'Continuous7Days'

@description('Entra ID object IDs that get read/write access to the data: your user now, the Function App managed identity later.')
param dataContributorPrincipalIds array = []

@description('Turn off account keys, so only Entra ID identities can reach the data. Recommended once the Functions use a managed identity.')
param disableKeyAuth bool = false

@description('Tags on the account.')
param tags object = {
  project: 'velo-stands'
  component: 'database'
}

// Cosmos DB Built-in Data Contributor (data plane: read and write items, no schema changes)
var dataContributorRoleId = '00000000-0000-0000-0000-000000000002'

var continuousBackup = {
  type: 'Continuous'
  continuousModeProperties: {
    tier: 'Continuous7Days'
  }
}

// Two copies, 4 h apart, kept in the same region: the free allowance of periodic mode
var periodicBackup = {
  type: 'Periodic'
  periodicModeProperties: {
    backupIntervalInMinutes: 240
    backupRetentionIntervalInHours: 8
    backupStorageRedundancy: 'Local'
  }
}

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: accountName
  location: location
  kind: 'GlobalDocumentDB'
  tags: tags
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      { name: 'EnableServerless' }
    ]
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false // zones cost 25 % more per request
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    backupPolicy: backupMode == 'Periodic' ? periodicBackup : continuousBackup
    enableFreeTier: false // not available for serverless accounts
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    enableAnalyticalStorage: false
    minimalTlsVersion: 'Tls12'
    publicNetworkAccess: 'Enabled' // the Functions run without a virtual network
    disableLocalAuth: disableKeyAuth
    disableKeyBasedMetadataWriteAccess: true // containers and indexes change only through this template
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: account
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// Site, areas, stands, devices and assignments. Small and read-mostly, so
// everything is indexed. One logical partition per site, so a device swap
// (close the old assignment, retire the device, open the new assignment) can
// be written as one transactional batch.
resource catalog 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: database
  name: 'catalog'
  properties: {
    resource: {
      id: 'catalog'
      partitionKey: {
        paths: [ '/siteId' ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
        // stand.location is a GeoJSON point: enables ST_DISTANCE for "nearest free stand"
        spatialIndexes: [
          {
            path: '/location/*'
            types: [ 'Point' ]
          }
        ]
      }
    }
  }
}

// One document per accepted reading, never updated. Expires after readingTtlDays.
// Write-heavy, so only the fields the queries filter or sort on are indexed.
resource readings 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: database
  name: 'readings'
  properties: {
    resource: {
      id: 'readings'
      partitionKey: {
        paths: [ '/standId' ]
        kind: 'Hash'
        version: 2
      }
      defaultTtl: readingTtlDays * 86400
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/standId/?' }
          { path: '/areaId/?' }
          { path: '/deviceId/?' }
          { path: '/source/?' }
          { path: '/receivedAt/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
        // "latest reading of device X before time T"
        compositeIndexes: [
          [
            { path: '/deviceId', order: 'ascending' }
            { path: '/receivedAt', order: 'ascending' }
          ]
        ]
      }
    }
  }
}

// One document per area (id = areaId) holding the latest count of each device.
// Only read by id or in full, so nothing beyond the key is indexed.
resource state 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: database
  name: 'state'
  properties: {
    resource: {
      id: 'state'
      partitionKey: {
        paths: [ '/areaId' ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/areaId/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

// One document per stand and hour (id = "<standId>:<hourStartUtc>"), kept forever.
// The weekday x hour profile is computed from these rows on read.
resource rollups 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: database
  name: 'rollups'
  properties: {
    resource: {
      id: 'rollups'
      partitionKey: {
        paths: [ '/standId' ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/standId/?' }
          { path: '/areaId/?' }
          { path: '/hourStartUtc/?' }
          { path: '/isWorkday/?' }
          { path: '/dayOfWeek/?' }
          { path: '/localHour/?' }
          { path: '/coverage/?' }
        ]
        excludedPaths: [
          { path: '/*' }
        ]
        // "workday hours of stand X in the last N weeks"
        compositeIndexes: [
          [
            { path: '/isWorkday', order: 'ascending' }
            { path: '/hourStartUtc', order: 'ascending' }
          ]
        ]
      }
    }
  }
}

resource dataAccess 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = [
  for principalId in dataContributorPrincipalIds: {
    parent: account
    name: guid(account.id, principalId, dataContributorRoleId)
    properties: {
      roleDefinitionId: '${account.id}/sqlRoleDefinitions/${dataContributorRoleId}'
      principalId: principalId
      scope: account.id
    }
  }
]

output accountName string = account.name
output endpoint string = account.properties.documentEndpoint
output databaseName string = database.name
output containers array = [
  catalog.name
  readings.name
  state.name
  rollups.name
]
