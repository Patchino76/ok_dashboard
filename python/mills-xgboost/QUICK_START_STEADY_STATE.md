# Quick Start - Steady-State Extraction

## 🚀 Run Tests (Copy & Paste)

### Activate Virtual Environment
```bash
C:\venv\crewai311\Scripts\activate
cd c:\Projects\ok_dashboard\python\mills-xgboost
```

### Test Phase 1: Data Preparation (~2 min)
```bash
C:\venv\crewai311\Scripts\python.exe app/optimization_cascade/tests/steady_state_tests/test_phase1_data_prep.py
```
**Output**: `app/optimization_cascade/tests/steady_state_tests/output/`
- ✅ Raw data plots
- ✅ Normalized data plots
- ✅ Correlation matrix
- ✅ Feature distributions

---

### Test Phase 2: Matrix Profile (~5-10 min)
```bash
C:\venv\crewai311\Scripts\python.exe app/optimization_cascade/tests/steady_state_tests/test_phase2_matrix_profile.py
```
**Output**: `app/optimization_cascade/tests/steady_state_tests/output/`
- ✅ Matrix profile overview
- ✅ Distance histogram
- ✅ Top 5 motifs (recurring patterns)
- ✅ Top 5 discords (anomalies)

---

### Test Complete Pipeline (~10-15 min)
```bash
C:\venv\crewai311\Scripts\python.exe app/optimization_cascade/tests/steady_state_tests/test_complete_pipeline.py
```
**Output**: `app/optimization_cascade/tests/steady_state_tests/output/`
- ✅ Steady-state dataset CSV
- ✅ Regime distribution plots
- ✅ Quality metrics
- ✅ Summary report

---

### Test Cascade Integration (~15-20 min)
```bash
C:\venv\crewai311\Scripts\python.exe app/optimization_cascade/tests/steady_state_tests/test_cascade_integration.py
```
**Output**: `app/optimization_cascade/tests/steady_state_tests/output/`
- ✅ Trained cascade models
- ✅ Performance comparison
- ✅ Integration report

---

## 📊 Expected Results

### Phase 1: Data Preparation
```
✅ Loaded 4320 rows with 10 columns
✅ Date range: 2025-01-01 to 2025-01-07
✅ Features: Ore, WaterMill, WaterZumpf, MotorAmp, PulpHC, DensityHC, PressureHC, Shisti, Daiki, Grano
✅ No missing values: True
```

### Phase 2: Matrix Profile
```
✅ Window size: 60 data points (60 minutes)
✅ Matrix profile computed: 4261 profile points
✅ Motif candidates: 850
✅ Discord candidates: 120
```

### Phase 3-5: Complete Pipeline
```
✅ Motifs discovered: 10
✅ Steady-state records extracted: 450
✅ Operating regimes identified: 3-5
✅ Average quality score: 0.75
```

### Cascade Integration
```
✅ Steady-state data: 450 records
✅ Baseline data: 4320 records
✅ Quality model R² improvement: +15-25%
✅ RMSE reduction: 10-20%
```

---

## 🔧 Quick Configuration Changes

### Test with Different Date Range
Edit test file, change:
```python
END_DATE = datetime.now()
START_DATE = END_DATE - timedelta(days=7)  # Change to 3, 5, 14, etc.
```

### Test Different Mill
Change:
```python
MILL_NUMBER = 8  # Change to 6, 7, 9, 10, etc.
```

### Adjust Quality Threshold
Change:
```python
QUALITY_THRESHOLD = 0.5  # Lower (0.3) = more data, Higher (0.7) = better quality
MIN_OCCURRENCES = 3      # Lower (2) = more patterns, Higher (5) = more consistent
```

---

## 📁 Output Location

All test outputs saved to:
```
c:\Projects\ok_dashboard\python\mills-xgboost\app\optimization_cascade\tests\steady_state_tests\output\
```

---

## ⚡ Troubleshooting

### "Module not found" Error
```bash
# Ensure you're in the correct directory
cd c:\Projects\ok_dashboard\python\mills-xgboost

# Verify Python path
C:\venv\crewai311\Scripts\python.exe -c "import sys; print(sys.path)"
```

### "Database connection failed"
- Check `config/settings.py` has correct DB credentials
- Verify VPN/network connection to database server
- Test with: `python -c "from config.settings import settings; print(settings.DB_HOST)"`

### "STUMPY not installed"
```bash
C:\venv\crewai311\Scripts\pip install stumpy
```

### Tests Running Too Slow
- Reduce date range to 3 days
- Use fewer features initially
- Check database connection speed

---

## 📖 Full Documentation

See: `STEADY_STATE_EXTRACTION_GUIDE.md` for complete documentation

---

## 🎯 What to Look For

### Good Results
- ✅ Multiple distinct motifs discovered (5-10)
- ✅ Motifs have 5+ occurrences each
- ✅ Consistency scores > 0.6
- ✅ Clear regime separation in plots
- ✅ Model R² improvement > 10%

### Needs Tuning
- ⚠️ Only 1-2 motifs found → Increase `n_motifs`, lower `quality_threshold`
- ⚠️ All motifs have < 3 occurrences → Lower `min_occurrences`
- ⚠️ All regimes labeled "Unstable" → Review labeling logic
- ⚠️ No model improvement → Check if data has steady-state periods

---

## 🔄 Typical Workflow

1. **Run Phase 1** → Verify data loads correctly
2. **Run Phase 2** → Check motifs look reasonable
3. **Run Complete Pipeline** → Get steady-state dataset
4. **Review Plots** → Validate patterns make sense
5. **Run Cascade Integration** → Compare model performance
6. **Tune Parameters** → Adjust based on results
7. **Deploy** → Use best configuration in production

---

## 💡 Pro Tips

- Start with **3-5 days** of data for testing
- Review **motif plots** to understand patterns
- Check **regime distribution** matches process knowledge
- Compare **baseline vs steady-state** model performance
- Save **good configurations** for future use

---

**Ready to start? Run Phase 1 test now! ⬆️**
