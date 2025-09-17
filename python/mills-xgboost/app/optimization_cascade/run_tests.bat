@echo off
echo ========================================
echo Mill Organization Test Runner
echo ========================================
echo.

REM Activate the specified virtual environment
echo Activating virtual environment...
call C:\venv\crewai311\Scripts\activate.bat

REM Check if activation was successful
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    echo Please ensure C:\venv\crewai311\Scripts\ exists
    pause
    exit /b 1
)

echo Virtual environment activated successfully!
echo.

REM Show Python version and location
echo Python Information:
python --version
echo Python location: 
python -c "import sys; print(sys.executable)"
echo.

REM Change to the script directory
cd /d "%~dp0"
echo Current directory: %CD%
echo.

REM Run the test script
echo ========================================
echo Running Mill Organization Tests...
echo ========================================
python test_mill_organization.py

echo.
echo ========================================
echo Running Mill Organization Demo...
echo ========================================
python demonstrate_mill_organization.py

echo.
echo ========================================
echo Tests completed!
echo ========================================
pause
