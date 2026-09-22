$ErrorActionPreference = 'Stop'
try {
 Add-Type -AssemblyName System.Drawing
 $bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd())
 $stream = New-Object System.IO.MemoryStream(,$bytes)
 $image = [System.Drawing.Image]::FromStream($stream)
 if ($image.Width * [long]$image.Height -gt 100000000) { throw 'Image too large' }
 if ($image.PropertyIdList -contains 274) {
  $orientation = [BitConverter]::ToUInt16($image.GetPropertyItem(274).Value,0)
  $rotations = @{2=4;3=2;4=6;5=5;6=1;7=7;8=3}
  if ($rotations.ContainsKey([int]$orientation)) { $image.RotateFlip([System.Drawing.RotateFlipType]$rotations[[int]$orientation]) }
 }
 $scale = [Math]::Min(1.0,1600.0/[Math]::Max($image.Width,$image.Height))
 $bitmap = New-Object System.Drawing.Bitmap([Math]::Max(1,[int]($image.Width*$scale)),[Math]::Max(1,[int]($image.Height*$scale)))
 if ($bitmap.Width -lt 32 -or $bitmap.Height -lt 32 -or $bitmap.Width -gt 1600 -or $bitmap.Height -gt 1600) { throw 'Prepared image dimensions are invalid' }
 $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.Clear([System.Drawing.Color]::White)
 $graphics.DrawImage($image,0,0,$bitmap.Width,$bitmap.Height)
 $output = New-Object System.IO.MemoryStream
 $bitmap.Save($output,[System.Drawing.Imaging.ImageFormat]::Jpeg)
 [Console]::Out.Write([Convert]::ToBase64String($output.ToArray()))
} catch { [Console]::Error.Write('Could not prepare this image. Use a smaller JPEG or PNG.'); exit 1 }
finally {foreach ($resource in @($graphics,$bitmap,$image,$stream,$output)) {if($resource){$resource.Dispose()}}}

