# Mills Forecasting - Testing Guide

## Quick Start

### 1. Start the Application

```bash
# Start the backend API
cd python
python api.py

# Start the frontend (in another terminal)
npm run dev
```

### 2. Navigate to Mills Forecasting

Open your browser and go to:

```
http://localhost:3000/mills-forecasting
```

---

## What to Look For

### ✅ Visual Indicators

#### Header Section

- **Green "LIVE DATA" badge** - Should be visible and pulsing
- **Active Mills count** - Should show "X / 10" (e.g., "7 / 10")
- **Current time** - Should update every minute
- **Active shift** - Should show correct shift (S1/S2/S3)

#### Production Values

- **Shift production** - Should show actual tonnage from database
- **Day production** - Should show actual total for the day
- **Current ore rate** - Should show sum of all active mills

---

## Browser Console Checks

### Expected Console Output

Every 20 seconds, you should see:

```javascript
📊 Real-time production data received: {
  totalOreRate: 165.3,
  shiftProduction: 1234.5,
  dayProduction: 3456.7,
  activeMillsCount: 7
}

🔄 Updating real-time data: {
  currentOreRate: 165.3,
  actualShiftProduction: 1234.5,
  actualDayProduction: 3456.7,
  activeMillsCount: 7
}
```

### How to Open Console

- **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I`
- **Firefox**: Press `F12` or `Ctrl+Shift+K`
- **Safari**: Press `Cmd+Option+I`

---

## Network Tab Verification

### Expected API Calls

Open Network tab (F12 → Network) and filter by "ore-by-mill":

You should see **10 parallel requests** every 20 seconds:

```
GET /api/mills/ore-by-mill?mill=Mill_1
GET /api/mills/ore-by-mill?mill=Mill_2
GET /api/mills/ore-by-mill?mill=Mill_3
...
GET /api/mills/ore-by-mill?mill=Mill_10
```

### Response Format

Each response should contain:

```json
{
  "title": "Mill_1",
  "state": true,
  "ore": 16.5,
  "shift1": 123.4,
  "shift2": 145.6,
  "shift3": 134.2,
  "total": 403.2
}
```

---

## Functional Testing

### Test 1: Real-Time Data Updates

1. **Open the page**
2. **Note the current ore rate** (e.g., 165.3 t/h)
3. **Wait 20 seconds**
4. **Check if values update** (should see new data in console)
5. **Verify forecast recalculates** (charts should update)

**Expected:** Data refreshes automatically every 20 seconds

---

### Test 2: Active Mills Count

1. **Check header** - Should show "X / 10"
2. **Compare with MillsPage** - Navigate to `/mills`
3. **Count running mills** - Should match the count
4. **Return to forecasting** - Count should be the same

**Expected:** Active mills count is accurate

---

### Test 3: Production Values

1. **Note shift production** (e.g., 1234.5 tons)
2. **Navigate to MillsPage** (`/mills`)
3. **Check individual mill shift totals**
4. **Sum them manually**
5. **Compare with forecasting page**

**Expected:** Values match between pages

---

### Test 4: Forecast Calculations

1. **Check "Production So Far"** in shift progress card
2. **Should match actual shift production** from API
3. **Check "Production Today"** in day progress card
4. **Should match actual day production** from API
5. **Verify forecast scenarios** (optimistic/expected/pessimistic)

**Expected:** Forecasts use real data, not calculations

---

### Test 5: Loading States

1. **Refresh the page**
2. **Should see** "Loading production data..."
3. **Then** "Calculating forecast..."
4. **Then** Full UI with data

**Expected:** Smooth loading progression

---

## Troubleshooting

### Issue: No "LIVE DATA" badge

**Possible Causes:**

- Store not initialized properly
- Check console for errors

**Solution:**

```javascript
// In browser console, check store state:
window.__ZUSTAND_STORE__;
```

---

### Issue: No data updates

**Possible Causes:**

- API not running
- Network errors
- React Query not refetching

**Check:**

1. Network tab - Are API calls happening?
2. Console - Any error messages?
3. API health - Visit `http://localhost:8000/api/health`

---

### Issue: Wrong production values

**Possible Causes:**

- Data aggregation error
- Mill data not available

**Debug:**

```javascript
// Check raw API response
fetch("http://localhost:8000/api/mills/ore-by-mill?mill=Mill_1")
  .then((r) => r.json())
  .then(console.log);
```

---

### Issue: Forecast not updating

**Possible Causes:**

- Store not updating
- useEffect dependencies issue

**Check:**

```javascript
// In console, verify store updates
// Should see logs every 20 seconds:
// "📊 Real-time production data received"
// "🔄 Updating real-time data"
```

---

## Performance Checks

### Memory Usage

1. **Open Performance tab** (F12 → Performance)
2. **Record for 1 minute**
3. **Check memory usage**

**Expected:** Stable memory, no leaks

---

### Network Usage

1. **Open Network tab**
2. **Monitor for 1 minute**
3. **Count requests**

**Expected:**

- 10 requests every 20 seconds
- ~30 requests per minute
- Each response < 1KB

---

## Edge Cases to Test

### 1. All Mills Stopped

- Active mills count should be 0
- Ore rate should be 0
- Forecast should still work

### 2. Single Mill Running

- Active mills count should be 1
- Ore rate should match that mill
- Forecast should be accurate

### 3. Network Interruption

- Disconnect network
- Should see retry attempts
- Should show error gracefully
- Reconnect - should resume

### 4. API Down

- Stop API server
- Should show loading state
- Should not crash
- Start API - should recover

---

## Success Criteria Checklist

- [ ] Green "LIVE DATA" badge visible
- [ ] Active mills count displays correctly
- [ ] Console shows data updates every 20 seconds
- [ ] Network tab shows 10 API calls every 20 seconds
- [ ] Production values match MillsPage
- [ ] Forecast uses real data (not calculations)
- [ ] Loading states work properly
- [ ] No console errors
- [ ] No memory leaks
- [ ] Smooth performance

---

## Comparison Test

### Before (Manual Mode)

- Ore rate: **Hardcoded 169.67 t/h**
- Shift production: **Calculated from assumptions**
- Day production: **Calculated from assumptions**
- Updates: **Manual only**

### After (Real-Time Mode)

- Ore rate: **Sum of all active mills (e.g., 165.3 t/h)**
- Shift production: **Actual from database (e.g., 1234.5 tons)**
- Day production: **Actual from database (e.g., 3456.7 tons)**
- Updates: **Automatic every 20 seconds**

---

## Data Accuracy Verification

### Step-by-Step Comparison

1. **Open Mills Forecasting page**

   - Note: Current Ore Rate = X
   - Note: Shift Production = Y
   - Note: Day Production = Z

2. **Open MillsPage** (`/mills`)

   - Sum all mill ore rates → Should equal X
   - Sum all shift totals → Should equal Y
   - Sum all day totals → Should equal Z

3. **Check Database** (optional)
   ```sql
   -- Query to verify shift production
   SELECT SUM(shift_total) FROM mills_data
   WHERE shift = CURRENT_SHIFT;
   ```

---

## Final Verification

### Complete Flow Test

1. ✅ Start application
2. ✅ Navigate to `/mills-forecasting`
3. ✅ See "LIVE DATA" badge
4. ✅ See active mills count
5. ✅ See production values
6. ✅ Wait 20 seconds
7. ✅ See console logs
8. ✅ See values update
9. ✅ Check Network tab
10. ✅ Verify API calls
11. ✅ Compare with MillsPage
12. ✅ Verify accuracy

**All checks pass?** ✅ Implementation successful!

---

## Report Issues

If you find any issues:

1. **Check console** for error messages
2. **Check Network tab** for failed requests
3. **Note the exact steps** to reproduce
4. **Capture screenshots** if possible
5. **Check browser compatibility** (Chrome, Firefox, Edge)

---

## Browser Compatibility

Tested and working on:

- ✅ Chrome 120+
- ✅ Firefox 120+
- ✅ Edge 120+
- ✅ Safari 17+

---

**Happy Testing! 🚀**
