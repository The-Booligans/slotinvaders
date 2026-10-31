// Velo Stands – Function App for the device API (Node.js 22)
//
// Cheapest setup for ~11 devices reporting once a minute (about 475,000 calls
// a month): the Consumption plan on Windows. Its monthly free grant of
// 1 million executions and 400,000 GB-s covers that load completely.
// Logs go to Application Insights with a daily cap, so debugging can't run up
// a bill.
//
//   resource                    purpose
//   --------------------------  -----------------------------------------------
//   storage account (LRS)       required by Azure Functions (code package, host state)
//   Log Analytics + App Insights  the function's log output, capped per day
//   Consumption plan (Y1)       pay per execution, scales to zero
//   Function App                runs the code, with a managed identity
//   Cosmos DB role assignment   lets that identity read and write the data, no keys
//   Web PubSub + hub            holds the app's WebSockets; the function pushes to it
//
// Deploy with deploy-function.ps1, or directly:
//   az deployment group create -g nag-rg-slotinvaders --template-file function.bicep -p cosmosAccountName=<account>

targetScope = 'resourceGroup'

@description('Azure region.')
param location string = 'switzerlandnorth'

@description('Name of the existing Cosmos DB account (created by deploy-cosmos.ps1).')
param cosmosAccountName string

@description('Name of the Cosmos DB database.')
param cosmosDatabaseName string = 'velostands'

@description('Globally unique name of the Function App. It becomes <name>.azurewebsites.net.')
@maxLength(60)
param appName string = 'func-velostands-${uniqueString(resourceGroup().id)}'

@description('Globally unique storage account name: 3-24 lowercase letters and digits.')
@maxLength(24)
param storageAccountName string = 'stvelo${uniqueString(resourceGroup().id)}'

@description('Daily cap for log ingestion in GB. 0.15 GB a day stays within the monthly free allowance of Log Analytics.')
param logDailyCapGb string = '0.15'

@description('true: log every step of every request. false: one summary line per request.')
param debugLogging bool = true

@description('Web PubSub tier. Free_F1: 20 connections and 20,000 messages a day, enough for development. Standard_S1 for the demo.')
@allowed([
  'Free_F1'
  'Standard_S1'
])
param pubsubSku string = 'Free_F1'

@description('Tags on every resource.')
param tags object = {
  project: 'velo-stands'
  component: 'api'
}

var suffix = uniqueString(resourceGroup().id)
var dataContributorRoleId = '00000000-0000-0000-0000-000000000002' // Cosmos DB Built-in Data Contributor

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-velostands-${suffix}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: json(logDailyCapGb)
    }
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-velostands-${suffix}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'plan-velostands-${suffix}'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {}
}

// Holds the app's WebSockets. The function sends to it: a broadcast every 10 s,
// and the current snapshot to each new connection (the `connected` event).
resource pubsub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: 'wps-velostands-${suffix}'
  location: location
  tags: tags
  sku: {
    name: pubsubSku
    capacity: 1
  }
  properties: {}
}

resource pubsubHub 'Microsoft.SignalRService/webPubSub/hubs@2024-03-01' = {
  parent: pubsub
  name: 'occupancy'
  properties: {
    anonymousConnectPolicy: 'deny'
    eventHandlers: [
      {
        urlTemplate: 'https://${appName}.azurewebsites.net/api/v1/pubsub/events'
        systemEvents: [
          'connected'
        ]
      }
    ]
  }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosAccountName
}

var storageConnection = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      use32BitWorkerProcess: false
      appSettings: [
        { name: 'AzureWebJobsStorage', value: storageConnection }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: storageConnection }
        { name: 'WEBSITE_CONTENTSHARE', value: toLower(appName) }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~22' }
        // The code runs from the zip that deploy-function.ps1 uploads. Kept here so
        // that running this template again doesn't unset it.
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
        { name: 'COSMOS_DATABASE', value: cosmosDatabaseName }
        { name: 'DEBUG_LOGGING', value: debugLogging ? 'true' : 'false' }
        { name: 'WEBPUBSUB_CONNECTION_STRING', value: pubsub.listKeys().primaryConnectionString }
        { name: 'WEBPUBSUB_HUB', value: pubsubHub.name }
      ]
    }
  }
}

// The Function App's identity may read and write items in Cosmos DB (not change containers).
resource cosmosAccess 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmos
  name: guid(cosmos.id, app.id, dataContributorRoleId)
  properties: {
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/${dataContributorRoleId}'
    principalId: app.identity.principalId
    scope: cosmos.id
  }
}

output appName string = app.name
output hostName string = app.properties.defaultHostName
output readingsUrl string = 'https://${app.properties.defaultHostName}/api/v1/readings'
output negotiateUrl string = 'https://${app.properties.defaultHostName}/api/v1/negotiate'
output pubsubName string = pubsub.name
output insightsName string = insights.name
output principalId string = app.identity.principalId
