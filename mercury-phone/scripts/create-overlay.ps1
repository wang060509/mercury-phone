param(
  [Parameter(Mandatory = $true)][string]$ReferencePath,
  [Parameter(Mandatory = $true)][string]$CurrentPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

Add-Type -AssemblyName System.Drawing

$reference = [System.Drawing.Bitmap]::FromFile($ReferencePath)
$current = [System.Drawing.Bitmap]::FromFile($CurrentPath)

try {
  if ($reference.Width -ne $current.Width -or $reference.Height -ne $current.Height) {
    throw "Reference and current image dimensions must match."
  }

  $overlay = New-Object System.Drawing.Bitmap($reference.Width, $reference.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($overlay)
  try {
    $graphics.DrawImage($reference, 0, 0, $reference.Width, $reference.Height)
    $matrix = New-Object System.Drawing.Imaging.ColorMatrix
    $matrix.Matrix33 = 0.5
    $attributes = New-Object System.Drawing.Imaging.ImageAttributes
    $attributes.SetColorMatrix($matrix)
    $destination = New-Object System.Drawing.Rectangle(0, 0, $current.Width, $current.Height)
    $graphics.DrawImage(
      $current,
      $destination,
      0,
      0,
      $current.Width,
      $current.Height,
      [System.Drawing.GraphicsUnit]::Pixel,
      $attributes
    )
    $overlay.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $attributes.Dispose()
  } finally {
    $graphics.Dispose()
    $overlay.Dispose()
  }
} finally {
  $reference.Dispose()
  $current.Dispose()
}
