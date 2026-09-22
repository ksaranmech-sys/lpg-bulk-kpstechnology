# Generates every app-icon variant from one square logo. Re-run after changing the logo:
#   powershell -ExecutionPolicy Bypass -File mobile/scripts/make-icons.ps1 -Source "C:\path\to\logo.png"
param(
  [Parameter(Mandatory = $true)][string]$Source
)

Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\assets'
$store = Join-Path $PSScriptRoot '..\store'
New-Item -ItemType Directory -Force -Path $assets, $store | Out-Null

$logo = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
Write-Host "Source: $($logo.Width)x$($logo.Height)"

function New-Canvas([int]$w, [int]$h, [System.Drawing.Color]$bg) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($bg)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @{ Bitmap = $bmp; Graphics = $g }
}

# Draws the logo scaled to `scale` of the canvas's shorter side, centred at (cx, cy).
function Draw-Logo($canvas, [double]$scale, [double]$cx, [double]$cy) {
  $bmp = $canvas.Bitmap
  $size = [int]([Math]::Min($bmp.Width, $bmp.Height) * $scale)
  $x = [int]($cx - $size / 2)
  $y = [int]($cy - $size / 2)
  $canvas.Graphics.DrawImage($logo, $x, $y, $size, $size)
}

function Save($canvas, [string]$path) {
  $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Graphics.Dispose(); $canvas.Bitmap.Dispose()
  Write-Host "Wrote $path"
}

# Play Console rejects PNGs with an alpha channel, so store assets are flattened to 24-bit RGB.
function Save-Opaque($canvas, [string]$path) {
  $src = $canvas.Bitmap
  $flat = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($flat)
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImageUnscaled($src, 0, 0)
  $g.Dispose()
  $flat.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $flat.Dispose()
  $canvas.Graphics.Dispose(); $canvas.Bitmap.Dispose()
  Write-Host "Wrote $path (24-bit)"
}

$white = [System.Drawing.Color]::White
$transparent = [System.Drawing.Color]::Transparent

# App icon (iOS + fallback): full-bleed logo, 1024x1024.
$c = New-Canvas 1024 1024 $white; Draw-Logo $c 1.0 512 512; Save $c (Join-Path $assets 'icon.png')

# Android adaptive icon foreground: the launcher masks to a circle/squircle covering the centre
# ~66%, so the logo is scaled to 70% on a transparent canvas; background is solid white.
$c = New-Canvas 1024 1024 $transparent; Draw-Logo $c 0.70 512 512; Save $c (Join-Path $assets 'android-icon-foreground.png')
$c = New-Canvas 1024 1024 $white; Save $c (Join-Path $assets 'android-icon-background.png')

# Splash: logo at 60% on white (app.json sets the same white background around it).
$c = New-Canvas 1024 1024 $white; Draw-Logo $c 0.60 512 512; Save $c (Join-Path $assets 'splash-icon.png')

# Web favicon.
$c = New-Canvas 48 48 $white; Draw-Logo $c 1.0 24 24; Save $c (Join-Path $assets 'favicon.png')

# Play Store listing assets.
$c = New-Canvas 512 512 $white; Draw-Logo $c 1.0 256 256; Save-Opaque $c (Join-Path $store 'play-icon-512.png')

$c = New-Canvas 1024 500 $white
Draw-Logo $c 0.88 250 250
$font = New-Object System.Drawing.Font 'Segoe UI', 42, ([System.Drawing.FontStyle]::Bold)
$fontSmall = New-Object System.Drawing.Font 'Segoe UI', 20
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 59, 75))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 119, 119))
$c.Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$c.Graphics.DrawString('LPG Fleet Driver', $font, $brush, 470, 170)
$c.Graphics.DrawString("Trips, diesel, expenses and salary`non the road", $fontSmall, $muted, 474, 245)
Save-Opaque $c (Join-Path $store 'feature-graphic-1024x500.png')

# Play Store header image: 16:9 at 4096x2304, same layout as the feature graphic scaled 4x.
$c = New-Canvas 4096 2304 $white
Draw-Logo $c 0.80 1100 1152
$fontXL = New-Object System.Drawing.Font 'Segoe UI', 170, ([System.Drawing.FontStyle]::Bold)
$fontXLSmall = New-Object System.Drawing.Font 'Segoe UI', 80
$c.Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$c.Graphics.DrawString('LPG Fleet Driver', $fontXL, $brush, 2050, 780)
$c.Graphics.DrawString("Trips, diesel, expenses and salary`non the road", $fontXLSmall, $muted, 2070, 1110)
# Saved as JPEG: Play caps the header image at 2 MB and the 24-bit PNG is ~2.8 MB.
$flat = New-Object System.Drawing.Bitmap 4096, 2304, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($flat); $g.Clear($white); $g.DrawImageUnscaled($c.Bitmap, 0, 0); $g.Dispose()
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]92)
$headerPath = Join-Path $store 'header-image-4096x2304.jpg'
$flat.Save($headerPath, $jpegCodec, $encParams)
$flat.Dispose(); $c.Graphics.Dispose(); $c.Bitmap.Dispose()
Write-Host "Wrote $headerPath (JPEG)"

# Android monochrome (themed) icon: silhouette of every non-white pixel, 432x432 as Android expects.
$mono = New-Canvas 432 432 $transparent
$src = New-Canvas 432 432 $white; Draw-Logo $src 0.70 216 216
for ($y = 0; $y -lt 432; $y++) {
  for ($x = 0; $x -lt 432; $x++) {
    $p = $src.Bitmap.GetPixel($x, $y)
    if (($p.R + $p.G + $p.B) -lt 690) { $mono.Bitmap.SetPixel($x, $y, [System.Drawing.Color]::Black) }
  }
}
$src.Graphics.Dispose(); $src.Bitmap.Dispose()
Save $mono (Join-Path $assets 'android-icon-monochrome.png')

# Play phone screenshots must be exactly 9:16. Phone captures are usually taller (9:20 etc.), so each
# file in store/screenshots/raw is scaled to fit and letterboxed onto a 1080x1920 white canvas.
$rawDir = Join-Path $store 'screenshots\raw'
if (Test-Path $rawDir) {
  $outDir = Join-Path $store 'screenshots'
  $i = 1
  Get-ChildItem $rawDir -Include *.png, *.jpg, *.jpeg -Recurse | Sort-Object Name | ForEach-Object {
    $shot = [System.Drawing.Image]::FromFile($_.FullName)
    $c = New-Canvas 1080 1920 $white
    $ratio = [Math]::Min(1080 / $shot.Width, 1920 / $shot.Height)
    $w = [int]($shot.Width * $ratio); $h = [int]($shot.Height * $ratio)
    $c.Graphics.DrawImage($shot, [int]((1080 - $w) / 2), [int]((1920 - $h) / 2), $w, $h)
    $shot.Dispose()
    Save-Opaque $c (Join-Path $outDir ('screenshot-{0:D2}.png' -f $i))
    $i++
  }
}

$logo.Dispose()
