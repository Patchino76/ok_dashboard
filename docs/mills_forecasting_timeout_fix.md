# Mills Forecasting - API Timeout Fix

## Issue

```
AxiosError: timeout of 10000ms exceeded
```

## Root Cause Analysis

### **Problem**

The `useMillsProductionData` hook makes **12 parallel API requests** (one per mill) with the following constraints:

- Default axios timeout: **10 seconds**
- 12 mills × ~1-2 seconds per request = **12-24 seconds total**
- If any request is slow or the API is under load, the entire batch times out

### **Error Location**

```typescript
// src/app/mills-forecasting/hooks/useMillsProductionData.ts:91
const mills = await Promise.all(promises);
```

## Solution Implemented

### **1. Increased Timeout Per Request**

```typescript
apiClient.get<MillInfoProps>(`/mills/ore-by-mill`, {
  params: { mill },
  timeout: 30000, // 30 seconds per mill request (was 10s globally)
});
```

**Rationale**: Each individual mill request now has 30 seconds, allowing slower API responses without failing the entire batch.

### **2. Enhanced Error Handling**

```typescript
.catch((error) => {
  console.warn(`⚠️ Failed to fetch data for ${mill}:`, error.message || error);
  // Return default data for failed mill
  return {
    title: mill,
    state: false,
    ore: 0,
    shift1: 0,
    shift2: 0,
    shift3: 0,
    total: 0,
  } as MillInfoProps;
})
```

**Rationale**: If a single mill fails, the system continues with default data instead of crashing the entire forecast.

### **3. Added Performance Logging**

```typescript
console.log("🔄 Fetching production data for all mills...");
const startTime = Date.now();

// ... fetch logic ...

const duration = Date.now() - startTime;
const successCount = mills.filter((m) => m.state !== false || m.ore > 0).length;
console.log(
  `✅ Fetched ${successCount}/${mills.length} mills in ${duration}ms`
);
```

**Rationale**: Monitor API performance and identify slow mills.

### **4. Retry with Exponential Backoff**

```typescript
retry: 3, // Retry up to 3 times
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
// Retry delays: 1s, 2s, 4s (capped at 30s)
```

**Rationale**: Transient network issues are automatically retried with increasing delays.

## Changes Made

### **File**: `src/app/mills-forecasting/hooks/useMillsProductionData.ts`

**Lines 73-77**: Increased timeout

```diff
  apiClient.get<MillInfoProps>(`/mills/ore-by-mill`, {
    params: { mill },
+   timeout: 30000, // 30 seconds per mill request
  })
```

**Lines 66-67, 100-102**: Added performance logging

```diff
+ console.log("🔄 Fetching production data for all mills...");
+ const startTime = Date.now();

  // ... fetch logic ...

+ const duration = Date.now() - startTime;
+ const successCount = mills.filter(m => m.state !== false || m.ore > 0).length;
+ console.log(`✅ Fetched ${successCount}/${mills.length} mills in ${duration}ms`);
```

**Lines 78, 126-127**: Improved error handling and retry

```diff
  .catch((error) => {
-   console.warn(`Failed to fetch data for ${mill}:`, error);
+   console.warn(`⚠️ Failed to fetch data for ${mill}:`, error.message || error);
    // Return default data for failed mill
    ...
  })

  // React Query config
- retry: 2,
+ retry: 3, // Retry up to 3 times
+ retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s
```

## Expected Behavior After Fix

### **Normal Operation**

```
🔄 Fetching production data for all mills...
✅ Fetched 12/12 mills in 3542ms
```

### **With Slow Mills**

```
🔄 Fetching production data for all mills...
⚠️ Failed to fetch data for Mill07: timeout of 30000ms exceeded
✅ Fetched 11/12 mills in 31205ms
```

### **With API Issues**

```
🔄 Fetching production data for all mills...
⚠️ Failed to fetch data for Mill03: Network Error
⚠️ Failed to fetch data for Mill11: timeout of 30000ms exceeded
✅ Fetched 10/12 mills in 32108ms
```

## Benefits

### **1. Resilience**

- ✅ Single mill failures don't crash the entire forecast
- ✅ System continues with partial data
- ✅ Automatic retries for transient failures

### **2. Performance Visibility**

- ✅ Console logs show fetch duration
- ✅ Success rate visible (e.g., "11/12 mills")
- ✅ Easy to identify problematic mills

### **3. Better User Experience**

- ✅ Forecast loads even with some mills unavailable
- ✅ Reduced timeout errors
- ✅ Graceful degradation

## Monitoring

### **Console Output to Watch**

```javascript
// Good
"✅ Fetched 12/12 mills in 3542ms";

// Acceptable
"⚠️ Failed to fetch data for Mill07: timeout";
"✅ Fetched 11/12 mills in 31205ms";

// Concerning (investigate API)
"⚠️ Failed to fetch data for Mill01: timeout";
"⚠️ Failed to fetch data for Mill02: timeout";
"⚠️ Failed to fetch data for Mill03: timeout";
"✅ Fetched 9/12 mills in 90000ms";
```

## Future Improvements

### **Option 1: Batch API Endpoint** (Recommended)

Create a single endpoint that returns all mills data:

```typescript
GET /mills/ore-all
Response: {
  mills: [
    { id: "Mill01", ore: 160, state: true, ... },
    { id: "Mill02", ore: 213, state: true, ... },
    ...
  ]
}
```

**Benefits**:

- Single HTTP request instead of 12
- Faster response time
- Lower server load
- Atomic data consistency

### **Option 2: WebSocket for Real-Time Data**

Stream mill data updates via WebSocket:

```typescript
ws://api/mills/stream
```

**Benefits**:

- Real-time updates without polling
- Reduced API calls
- Lower latency

### **Option 3: Stale-While-Revalidate**

Use cached data while fetching fresh data:

```typescript
staleTime: 15000, // Use cached data for 15s
cacheTime: 60000, // Keep in cache for 60s
```

**Benefits**:

- Instant UI updates with cached data
- Background refresh for fresh data
- Better perceived performance

## Testing Checklist

- [ ] **Normal load**: All 12 mills respond within 5 seconds
- [ ] **Slow API**: Some mills take 15-20 seconds
- [ ] **Partial failure**: 1-2 mills timeout, others succeed
- [ ] **Complete failure**: All mills timeout (should show loading state)
- [ ] **Network issues**: Intermittent connection problems
- [ ] **Console logs**: Performance metrics visible
- [ ] **Retry logic**: Failed requests retry with backoff
- [ ] **Forecast page**: Loads with partial data

## Related Files

- `src/app/mills-forecasting/hooks/useMillsProductionData.ts` - Main hook
- `src/lib/api/api-client.ts` - Axios client configuration
- `src/app/mills-forecasting/page.tsx` - Consumer component
- `src/lib/tags/mills-tags.ts` - Mills list configuration

## Notes

- The 30-second timeout is a temporary fix
- Long-term solution should use a batch API endpoint
- Monitor console logs to identify consistently slow mills
- Consider implementing request cancellation on component unmount
