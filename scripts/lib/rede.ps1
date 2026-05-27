# Detecta IP da rede local para acesso via Wi-Fi
function Get-LanIp {
  $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notmatch '^127\.' -and
      $_.IPAddress -notmatch '^169\.254\.' -and
      ($_.IPAddress -match '^192\.168\.' -or $_.IPAddress -match '^10\.' -or $_.IPAddress -match '^172\.(1[6-9]|2\d|3[01])\.')
    } |
    Sort-Object -Property InterfaceMetric, PrefixLength

  if ($candidates) {
    return ($candidates | Select-Object -First 1).IPAddress
  }
  return "127.0.0.1"
}

function Enable-AtlasFirewall {
  $ruleName = "Atlas One HTTP (porta 80)"
  $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if (!$existing) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow -Profile Private,Domain -ErrorAction SilentlyContinue | Out-Null
  }
}
