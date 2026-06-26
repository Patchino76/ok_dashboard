# Build script: обединява разделите 01–09 в един Стратегия.md.
# Генерира челна страница с лого, заглавие, дата и изготвил,
# простотекстово съдържание (само раздели, без линкове, без страници)
# и йерархично номерирани раздели.
#
# Употреба (с PowerShell 7 / pwsh заради UTF-8):
#   pwsh -ExecutionPolicy Bypass -File .\build_strategy.ps1
#
# Генериране на Word с pandoc (без auto-TOC; съдържанието е ръчно, текстово):
#   pandoc "Стратегия.md" -o "Стратегия.docx" --number-sections --reference-doc=reference.docx
#
# Забележка: reference.docx носи фирмения стил на Елаците-МЕД (шрифтове, теракотени
# заглавия). Регенерира се с: python brand_reference.py

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$outFile = Join-Path $root 'Стратегия.md'

# Подредени раздели: файл + заглавие + котва
$sections = @(
    @{ File = '01_Изпълнително_резюме.md';            Title = 'Изпълнително резюме';        Id = 'sec-01' },
    @{ File = '02_Текущо_състояние_As-Is.md';         Title = 'Текущо състояние (As-Is)';   Id = 'sec-02' },
    @{ File = '03_Визия_и_цели_To-Be.md';             Title = 'Визия и цели (To-Be)';       Id = 'sec-03' },
    @{ File = '04_Покритие_по_цехове.md';             Title = 'Покритие по цехове';         Id = 'sec-04' },
    @{ File = '05_Архитектура_на_компонентите.md';    Title = 'Архитектура на компонентите'; Id = 'sec-05' },
    @{ File = '06_Ползи_по_роли.md';                  Title = 'Ползи по роли';              Id = 'sec-06' },
    @{ File = '07_Инвестиционна_програма.md';         Title = 'Инвестиционна програма';     Id = 'sec-07' },
    @{ File = '08_Пътна_карта.md';                    Title = 'План за изпълнение';         Id = 'sec-08' },
    @{ File = '09_KPI_Рискове_Управление.md';         Title = 'KPI, рискове и управление';  Id = 'sec-09' }
)

$sb = [System.Text.StringBuilder]::new()

# --- Челна страница ---
[void]$sb.AppendLine('# Стратегия за развитие на интелигентна платформа с изкуствен интелект Profimine в обогатителната фабрика "Елаците-МЕД" АД {.unnumbered}')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| Дата: | Изготвил: |')
[void]$sb.AppendLine('|:---|:---|')
[void]$sb.AppendLine('| 26-06-2026г. | / Светослав Любенов / |')
[void]$sb.AppendLine('')

# Странична разделителна (raw openxml – видима само в docx)
[void]$sb.AppendLine('```{=openxml}')
[void]$sb.AppendLine('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
[void]$sb.AppendLine('```')
[void]$sb.AppendLine('')

# --- Простотекстово съдържание (само раздели, без линкове, без страници) ---
[void]$sb.AppendLine('# Съдържание {.unnumbered}')
[void]$sb.AppendLine('')
$i = 1
foreach ($s in $sections) {
    [void]$sb.AppendLine("$i. $($s.Title)")
    $i++
}
[void]$sb.AppendLine('')

# Странична разделителна
[void]$sb.AppendLine('```{=openxml}')
[void]$sb.AppendLine('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
[void]$sb.AppendLine('```')
[void]$sb.AppendLine('')

$rxFirstH1 = [regex]'(?m)^\s*#\s.*$'
$rxNumHead  = [regex]'(?m)^(#{1,6})\s+\d+(?:\.\d+)*\.\s+'

foreach ($s in $sections) {
    $path = Join-Path $root $s.File
    if (-not (Test-Path $path)) { throw "Липсва файл: $($s.File)" }
    $content = Get-Content -Path $path -Raw -Encoding UTF8

    $anchored = "# $($s.Title) {#$($s.Id)}"
    $content = $rxFirstH1.Replace($content, $anchored, 1)
    $content = $rxNumHead.Replace($content, '$1 ')

    [void]$sb.AppendLine('')
    [void]$sb.AppendLine($content.TrimEnd())
    [void]$sb.AppendLine('')
}

# Запис в UTF-8 без BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), $utf8NoBom)

Write-Host "Готово: $outFile"
