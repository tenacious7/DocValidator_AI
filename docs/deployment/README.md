# Deployment Guide

## Overview

This guide covers the complete deployment process for the AI Document Validation System across different environments, from local development to production deployment on Azure and Netlify.

## Prerequisites

### Required Tools
- Node.js 18+ and npm 8+
- Python 3.9+ and pip
- Docker and Docker Compose
- Azure CLI
- Netlify CLI
- Git

### Azure Resources
- Azure Subscription
- Resource Group
- App Service Plan
- Cosmos DB Account
- Storage Account
- Computer Vision Service
- Text Analytics Service

## Environment Setup

### 1. Local Development

#### Clone Repository
```bash
git clone https://github.com/your-org/ai-document-validation.git
cd ai-document-validation
```

#### Install Dependencies
```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..

# Frontend dependencies
cd frontend && npm install && cd ..

# Python AI services
pip install -r ai-services/requirements.txt
```

#### Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**
```bash
# Database
COSMOS_DB_ENDPOINT=https://your-cosmos-db.documents.azure.com:443/
COSMOS_DB_KEY=your-cosmos-db-key
COSMOS_DB_DATABASE_ID=docvalidation
COSMOS_DB_CONTAINER_ID=documents

# Azure Services
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
AZURE_COMPUTER_VISION_ENDPOINT=https://your-cv-service.cognitiveservices.azure.com/
AZURE_COMPUTER_VISION_KEY=your-cv-key
AZURE_TEXT_ANALYTICS_ENDPOINT=https://your-ta-service.cognitiveservices.azure.com/
AZURE_TEXT_ANALYTICS_KEY=your-ta-key

# Security
JWT_SECRET=your-super-secret-jwt-key
BCRYPT_ROUNDS=12

# Redis
REDIS_URL=redis://localhost:6379

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# AI Services
PYTHON_SERVICE_URL=http://localhost:8000
```

#### Start Development Servers
```bash
# Start all services
npm run dev:all

# Or start individually
npm run dev:backend    # Backend API on port 3001
npm run dev:frontend   # Frontend on port 5173
npm run dev:ai         # AI services on port 8000
```

### 2. Docker Development

#### Build and Run with Docker Compose
```bash
# Development environment
docker-compose --profile dev up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Individual Service Containers
```bash
# Build backend
docker build -t docvalidation-backend ./backend

# Build AI services
docker build -t docvalidation-ai ./ai-services

# Run with custom network
docker network create docvalidation-network
docker run -d --network docvalidation-network --name backend docvalidation-backend
docker run -d --network docvalidation-network --name ai-services docvalidation-ai
```

## Production Deployment

### 1. Azure Backend Deployment

#### Create Azure Resources
```bash
# Login to Azure
az login

# Create resource group
az group create --name rg-docvalidation --location eastus

# Create App Service Plan
az appservice plan create \
  --name plan-docvalidation \
  --resource-group rg-docvalidation \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name app-docvalidation-api \
  --resource-group rg-docvalidation \
  --plan plan-docvalidation \
  --runtime "NODE|18-lts"

# Create Cosmos DB
az cosmosdb create \
  --name cosmos-docvalidation \
  --resource-group rg-docvalidation \
  --kind GlobalDocumentDB

# Create Storage Account
az storage account create \
  --name stdocvalidation \
  --resource-group rg-docvalidation \
  --location eastus \
  --sku Standard_LRS

# Create Computer Vision Service
az cognitiveservices account create \
  --name cv-docvalidation \
  --resource-group rg-docvalidation \
  --kind ComputerVision \
  --sku S1 \
  --location eastus

# Create Text Analytics Service
az cognitiveservices account create \
  --name ta-docvalidation \
  --resource-group rg-docvalidation \
  --kind TextAnalytics \
  --sku S1 \
  --location eastus
```

#### Configure App Service
```bash
# Set environment variables
az webapp config appsettings set \
  --name app-docvalidation-api \
  --resource-group rg-docvalidation \
  --settings \
    NODE_ENV=production \
    COSMOS_DB_ENDPOINT="$(az cosmosdb show --name cosmos-docvalidation --resource-group rg-docvalidation --query documentEndpoint -o tsv)" \
    COSMOS_DB_KEY="$(az cosmosdb keys list --name cosmos-docvalidation --resource-group rg-docvalidation --query primaryMasterKey -o tsv)" \
    AZURE_STORAGE_ACCOUNT_NAME=stdocvalidation \
    AZURE_STORAGE_ACCOUNT_KEY="$(az storage account keys list --account-name stdocvalidation --resource-group rg-docvalidation --query '[0].value' -o tsv)"

# Configure deployment source
az webapp deployment source config \
  --name app-docvalidation-api \
  --resource-group rg-docvalidation \
  --repo-url https://github.com/your-org/ai-document-validation \
  --branch main \
  --manual-integration
```

#### Deploy Backend
```bash
# Build and deploy
npm run build:backend

# Deploy to Azure
az webapp deploy \
  --name app-docvalidation-api \
  --resource-group rg-docvalidation \
  --src-path ./backend/dist.zip
```

### 2. AI Services Deployment

#### Create Container Registry
```bash
# Create Azure Container Registry
az acr create \
  --name acrdocvalidation \
  --resource-group rg-docvalidation \
  --sku Basic \
  --admin-enabled true

# Login to registry
az acr login --name acrdocvalidation
```

#### Build and Push AI Services
```bash
# Build AI services image
docker build -t acrdocvalidation.azurecr.io/ai-services:latest ./ai-services

# Push to registry
docker push acrdocvalidation.azurecr.io/ai-services:latest

# Create Container Instance
az container create \
  --name aci-ai-services \
  --resource-group rg-docvalidation \
  --image acrdocvalidation.azurecr.io/ai-services:latest \
  --cpu 2 \
  --memory 4 \
  --ports 8000 \
  --environment-variables \
    AZURE_COMPUTER_VISION_ENDPOINT="$(az cognitiveservices account show --name cv-docvalidation --resource-group rg-docvalidation --query properties.endpoint -o tsv)" \
    AZURE_COMPUTER_VISION_KEY="$(az cognitiveservices account keys list --name cv-docvalidation --resource-group rg-docvalidation --query key1 -o tsv)"
```

### 3. Frontend Deployment (Netlify)

#### Build Frontend
```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build
```

#### Deploy to Netlify

**Option 1: Netlify CLI**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

**Option 2: Git Integration**
1. Connect GitHub repository to Netlify
2. Configure build settings:
   - Build command: `cd frontend && npm run build`
   - Publish directory: `frontend/dist`
   - Environment variables: Set API endpoints

#### Configure Environment Variables
```bash
# Set environment variables in Netlify dashboard
VITE_API_BASE_URL=https://app-docvalidation-api.azurewebsites.net/api
VITE_AI_SERVICE_URL=https://aci-ai-services.eastus.azurecontainer.io:8000
```

## Infrastructure as Code

### Terraform Configuration

#### Main Configuration
```hcl
# terraform/main.tf
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "rg-docvalidation"
  location = "East US"
}

resource "azurerm_cosmosdb_account" "main" {
  name                = "cosmos-docvalidation"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }
}

resource "azurerm_storage_account" "main" {
  name                     = "stdocvalidation"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_cognitive_account" "computer_vision" {
  name                = "cv-docvalidation"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "ComputerVision"
  sku_name            = "S1"
}
```

#### Deploy with Terraform
```bash
cd terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply configuration
terraform apply
```

## Monitoring and Logging

### Application Insights Setup
```bash
# Create Application Insights
az monitor app-insights component create \
  --app ai-docvalidation \
  --location eastus \
  --resource-group rg-docvalidation \
  --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app ai-docvalidation \
  --resource-group rg-docvalidation \
  --query instrumentationKey -o tsv)

# Configure in App Service
az webapp config appsettings set \
  --name app-docvalidation-api \
  --resource-group rg-docvalidation \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

### Log Analytics Workspace
```bash
# Create Log Analytics Workspace
az monitor log-analytics workspace create \
  --workspace-name law-docvalidation \
  --resource-group rg-docvalidation \
  --location eastus
```

## Security Configuration

### SSL/TLS Setup
```bash
# Enable HTTPS only
az webapp update \
  --name app-docvalidation-api \
  --resource-group rg-docvalidation \
  --https-only true

# Configure custom domain (optional)
az webapp config hostname add \
  --webapp-name app-docvalidation-api \
  --resource-group rg-docvalidation \
  --hostname api.docvalidation.com
```

### Key Vault Integration
```bash
# Create Key Vault
az keyvault create \
  --name kv-docvalidation \
  --resource-group rg-docvalidation \
  --location eastus

# Store secrets
az keyvault secret set \
  --vault-name kv-docvalidation \
  --name "CosmosDBKey" \
  --value "$(az cosmosdb keys list --name cosmos-docvalidation --resource-group rg-docvalidation --query primaryMasterKey -o tsv)"

# Configure App Service to use Key Vault
az webapp identity assign \
  --name app-docvalidation-api \
  --resource-group rg-docvalidation

# Grant access to Key Vault
az keyvault set-policy \
  --name kv-docvalidation \
  --object-id "$(az webapp identity show --name app-docvalidation-api --resource-group rg-docvalidation --query principalId -o tsv)" \
  --secret-permissions get
```

## Performance Optimization

### CDN Configuration
```bash
# Create CDN profile
az cdn profile create \
  --name cdn-docvalidation \
  --resource-group rg-docvalidation \
  --sku Standard_Microsoft

# Create CDN endpoint
az cdn endpoint create \
  --name cdn-docvalidation-api \
  --profile-name cdn-docvalidation \
  --resource-group rg-docvalidation \
  --origin app-docvalidation-api.azurewebsites.net
```

### Auto-scaling Configuration
```bash
# Configure auto-scaling
az monitor autoscale create \
  --name autoscale-docvalidation \
  --resource-group rg-docvalidation \
  --resource app-docvalidation-api \
  --resource-type Microsoft.Web/serverfarms \
  --min-count 1 \
  --max-count 10 \
  --count 2

# Add scale-out rule
az monitor autoscale rule create \
  --name scale-out \
  --autoscale-name autoscale-docvalidation \
  --resource-group rg-docvalidation \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 1
```

## Backup and Disaster Recovery

### Database Backup
```bash
# Configure automatic backup for Cosmos DB
az cosmosdb sql database throughput update \
  --account-name cosmos-docvalidation \
  --resource-group rg-docvalidation \
  --name docvalidation \
  --throughput 400

# Enable point-in-time restore
az cosmosdb update \
  --name cosmos-docvalidation \
  --resource-group rg-docvalidation \
  --enable-analytical-storage true
```

### Storage Backup
```bash
# Configure blob storage backup
az storage account blob-service-properties update \
  --account-name stdocvalidation \
  --resource-group rg-docvalidation \
  --enable-versioning true \
  --enable-delete-retention true \
  --delete-retention-days 30
```

## Health Checks and Monitoring

### Health Check Endpoints
```bash
# Configure health check
az webapp config set \
  --name app-docvalidation-api \
  --resource-group rg-docvalidation \
  --health-check-path "/api/health"
```

### Alerts Configuration
```bash
# Create action group
az monitor action-group create \
  --name ag-docvalidation \
  --resource-group rg-docvalidation \
  --short-name docval

# Create alert rule
az monitor metrics alert create \
  --name "High CPU Usage" \
  --resource-group rg-docvalidation \
  --scopes "/subscriptions/{subscription-id}/resourceGroups/rg-docvalidation/providers/Microsoft.Web/sites/app-docvalidation-api" \
  --condition "avg Percentage CPU > 80" \
  --action ag-docvalidation
```

## Troubleshooting

### Common Issues

1. **Deployment Failures**
   ```bash
   # Check deployment logs
   az webapp log tail --name app-docvalidation-api --resource-group rg-docvalidation
   
   # Check application logs
   az webapp log download --name app-docvalidation-api --resource-group rg-docvalidation
   ```

2. **Database Connection Issues**
   ```bash
   # Test Cosmos DB connectivity
   az cosmosdb check-name-exists --name cosmos-docvalidation
   
   # Verify firewall settings
   az cosmosdb network-rule list --name cosmos-docvalidation --resource-group rg-docvalidation
   ```

3. **AI Services Issues**
   ```bash
   # Check container logs
   az container logs --name aci-ai-services --resource-group rg-docvalidation
   
   # Restart container
   az container restart --name aci-ai-services --resource-group rg-docvalidation
   ```

### Performance Monitoring
```bash
# Monitor application performance
az monitor metrics list \
  --resource "/subscriptions/{subscription-id}/resourceGroups/rg-docvalidation/providers/Microsoft.Web/sites/app-docvalidation-api" \
  --metric "Http2xx,Http4xx,Http5xx,ResponseTime"
```

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and rotate secrets quarterly
- Monitor costs and optimize resources
- Update SSL certificates annually
- Review and update backup policies

### Update Process
```bash
# Update backend
git pull origin main
npm run build:backend
az webapp deploy --name app-docvalidation-api --resource-group rg-docvalidation

# Update AI services
docker build -t acrdocvalidation.azurecr.io/ai-services:latest ./ai-services
docker push acrdocvalidation.azurecr.io/ai-services:latest
az container restart --name aci-ai-services --resource-group rg-docvalidation

# Update frontend
cd frontend && npm run build
netlify deploy --prod --dir=dist
```