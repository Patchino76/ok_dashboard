# Mill Organization Test Runner (PowerShell)
# Usage: .\run_tests.ps1

Write-Host "========================================" -ForegroundColor Green
Write-Host "Mill Organization Test Runner" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Set virtual environment path
$venvPath = "C:\venv\crewai311\Scripts\Activate.ps1"

# Check if virtual environment exists
if (-not (Test-Path $venvPath)) {
    Write-Host "ERROR: Virtual environment not found at $venvPath" -ForegroundColor Red
    Write-Host "Please ensure C:\venv\crewai311\Scripts\ exists" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
try {
    & $venvPath
    Write-Host "Virtual environment activated successfully!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to activate virtual environment" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Show Python information
Write-Host "Python Information:" -ForegroundColor Cyan
python --version
Write-Host "Python location:" -ForegroundColor Cyan
python -c "import sys; print(sys.executable)"
Write-Host ""

# Change to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host ""

# Run test script
Write-Host "========================================" -ForegroundColor Green
Write-Host "Running Mill Organization Tests..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

try {
    python test_mill_organization.py
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Running Mill Organization Demo..." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
    python demonstrate_mill_organization.py
    
} catch {
    Write-Host "ERROR: Test execution failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Tests completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Read-Host "Press Enter to exit"
