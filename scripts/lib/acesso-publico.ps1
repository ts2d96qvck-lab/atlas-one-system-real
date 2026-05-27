function Update-PublicUrlInEnv {
  param([string]$Root, [string]$PublicUrl)

  if (!$PublicUrl) { return }

  foreach ($envPath in @(
    (Join-Path $Root "apps\server\.env"),
    (Join-Path $Root ".env")
  )) {
    if (!(Test-Path $envPath)) { continue }
    $content = Get-Content $envPath -Raw
    if ($content -match '(?m)^WEBHOOK_PUBLIC_URL=') {
      $content = [regex]::Replace($content, '(?m)^WEBHOOK_PUBLIC_URL=.*$', "WEBHOOK_PUBLIC_URL=$PublicUrl")
    } else {
      $content = "$content`nWEBHOOK_PUBLIC_URL=$PublicUrl"
    }
    if ($content -match '(?m)^APP_PUBLIC_URL=') {
      $content = [regex]::Replace($content, '(?m)^APP_PUBLIC_URL=.*$', "APP_PUBLIC_URL=$PublicUrl")
    } else {
      $content = "$content`nAPP_PUBLIC_URL=$PublicUrl"
    }
    if ($envPath -like "*\apps\server\.env") {
      if ($content -match '(?m)^CORS_ORIGINS=') {
        $content = [regex]::Replace($content, '(?m)^CORS_ORIGINS=.*$', "CORS_ORIGINS=$PublicUrl")
      } else {
        $content = "$content`nCORS_ORIGINS=$PublicUrl"
      }
    }
    Set-Content -Path $envPath -Value $content.TrimEnd() -Encoding UTF8
  }
}

function Sync-EvolutionWebhook {
  param([string]$Root, [string]$PublicUrl)

  if (!$PublicUrl) { return $false }

  $serverEnv = Join-Path $Root "apps\server\.env"
  if (!(Test-Path $serverEnv)) { return $false }

  $envRaw = Get-Content $serverEnv -Raw
  $apiKey = ""
  $evolutionUrl = "http://localhost:8080"
  if ($envRaw -match '(?m)^EVOLUTION_API_KEY=(.+)$') { $apiKey = $Matches[1].Trim() }
  if ($envRaw -match '(?m)^EVOLUTION_URL=(.+)$') { $evolutionUrl = $Matches[1].Trim() }

  $webhookUrl = "$($PublicUrl.TrimEnd('/'))/webhook/evolution/atlas-one"
  $payload = @{
    webhook = @{
      enabled = $true
      url = $webhookUrl
      webhookByEvents = $false
      webhook_base64 = $true
      webhookBase64 = $true
      events = @(
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "MESSAGES_SET",
        "SEND_MESSAGE",
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED"
      )
    }
  } | ConvertTo-Json -Depth 6

  try {
    $instances = Invoke-RestMethod -Uri "$evolutionUrl/instance/fetchInstances" -Headers @{ apikey = $apiKey } -TimeoutSec 15
    foreach ($instance in @($instances)) {
      if ($instance.connectionStatus -ne "open") { continue }
      $name = [uri]::EscapeDataString($instance.name)
      Invoke-RestMethod -Method POST -Uri "$evolutionUrl/webhook/set/$name" -Headers @{
        apikey = $apiKey
        "content-type" = "application/json"
      } -Body $payload -TimeoutSec 20 | Out-Null
    }
    return $true
  } catch {
    return $false
  }
}
