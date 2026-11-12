$ErrorActionPreference = 'Stop'
$folder = $PSScriptRoot
$wordApp = $null
$reportDoc = $null
try {
  $wordApp = New-Object -ComObject Word.Application
  $wordApp.Visible = $false
  $wordApp.DisplayAlerts = 0
  $reportDoc = $wordApp.Documents.Open((Join-Path $folder 'CDS528_Report.docx'), $false, $true)
  $reportDoc.Repaginate()
  Write-Output "Report pages: $($reportDoc.ComputeStatistics(2))"
  $reportDoc.ExportAsFixedFormat((Join-Path $folder 'CDS528_Report.pdf'), 17)
} finally {
  if ($reportDoc) { $reportDoc.Close(0) }
  if ($wordApp) { $wordApp.Quit() }
}
$powerpointApp = $null
$deck = $null
try {
  $powerpointApp = New-Object -ComObject PowerPoint.Application
  $deck = $powerpointApp.Presentations.Open((Join-Path $folder 'CDS528_Presentation.pptx'), -1, 0, 0)
  $deck.SaveAs((Join-Path $folder 'CDS528_Presentation.pdf'), 32)
  $previewFolder = Join-Path $folder 'slide-previews'
  New-Item -ItemType Directory -Path $previewFolder -Force | Out-Null
  $deck.Export($previewFolder, 'PNG', 1600, 900)
  Write-Output "Slide count: $($deck.Slides.Count)"
} finally {
  if ($deck) { $deck.Close() }
  if ($powerpointApp) { $powerpointApp.Quit() }
}
