# Levanta la app en tu computadora para probarla antes de subirla.
#
# La app usa módulos de JavaScript, así que abrir index.html con doble clic
# NO funciona: el navegador los bloquea. Hace falta servirla, y eso es lo
# único que hace este script.
#
# Cómo usarlo, parado en la carpeta del proyecto:
#
#     .\servir.ps1
#
# Después abrí http://localhost:8080 en Chrome. Para cortarlo, Ctrl+C.

param(
    [int]$Puerto = 8080
)

$raiz = $PSScriptRoot
if (-not $raiz) { $raiz = (Get-Location).Path }

# Se apoya en Python si está instalado, que es lo más simple y confiable.
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }

if ($python) {
    Write-Host ""
    Write-Host "  PES6 Liga Manager" -ForegroundColor Cyan
    Write-Host "  Abrí: " -NoNewline
    Write-Host "http://localhost:$Puerto" -ForegroundColor Yellow
    Write-Host "  Para cortarlo: Ctrl+C"
    Write-Host ""
    Push-Location $raiz
    try { & $python.Source -m http.server $Puerto }
    finally { Pop-Location }
    return
}

# Sin Python, se usa un servidor mínimo de .NET.
Write-Host "  (Python no está instalado, se usa el servidor de .NET)" -ForegroundColor DarkGray

$tipos = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.md'   = 'text/markdown; charset=utf-8'
}

$escucha = New-Object System.Net.HttpListener
$escucha.Prefixes.Add("http://localhost:$Puerto/")

try { $escucha.Start() }
catch {
    Write-Host "  No se pudo abrir el puerto $Puerto. Probá con otro:" -ForegroundColor Red
    Write-Host "      .\servir.ps1 -Puerto 8081"
    return
}

Write-Host ""
Write-Host "  PES6 Liga Manager" -ForegroundColor Cyan
Write-Host "  Abrí: " -NoNewline
Write-Host "http://localhost:$Puerto" -ForegroundColor Yellow
Write-Host "  Para cortarlo: Ctrl+C"
Write-Host ""

while ($escucha.IsListening) {
    $ctx = $escucha.GetContext()
    $ruta = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($ruta -eq '/') { $ruta = '/index.html' }

    $archivo = Join-Path $raiz ($ruta.TrimStart('/') -replace '/', '\')

    if (Test-Path $archivo -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($archivo).ToLower()
        $ctx.Response.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($archivo)
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host "  200  $ruta" -ForegroundColor DarkGray
    } else {
        $ctx.Response.StatusCode = 404
        Write-Host "  404  $ruta" -ForegroundColor DarkYellow
    }
    $ctx.Response.OutputStream.Close()
}
