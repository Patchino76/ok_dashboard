# Analytics Page - Statistics & Analytics Tabs Implementation

## Overview
Comprehensive implementation of advanced statistical analysis and actionable insights for the Analytics page, matching the beautiful design of the existing Comparison and Trends tabs.

---

## Statistics Tab Features

### 1. Statistical Summary Cards (8 Cards)
- **Средна стойност (Mean)** - Blue border
- **Медиана (Median)** - Green border
- **Стандартно отклонение (Std Dev)** - Orange border
- **Коефициент на вариация (CV%)** - Purple border
- **Минимум** - Red border (with mill identification)
- **Максимум** - Emerald border (with mill identification)
- **Диапазон (Range)** - Indigo border
- **Междуквартилен размах (IQR)** - Teal border

### 2. Distribution Visualization
- **Histogram** with 10 bins
  - Horizontal bar chart showing value distribution
  - Count display for each bin
  - Blue gradient bars
  
- **Box Plot** 
  - Visual representation of quartiles
  - Min/Max whiskers
  - Q1, Median, Q3 box
  - Interactive display with values

### 3. Mill Performance Matrix
- **Table format** with columns:
  - Мелница (Mill name in Bulgarian)
  - Средно (Mean value)
  - Стабилност (Stability %) - Color coded:
    - Green: < 10% (Excellent)
    - Yellow: 10-20% (Good)
    - Red: > 20% (Unstable)
  - Тренд (Trend indicator):
    - ↑ Improving (green)
    - → Stable (gray)
    - ↓ Declining (red)

### 4. Additional Statistics Section
Three-column breakdown:
- **Квартили (Quartiles)**: Q1, Q2 (Median), Q3
- **Разсейване (Dispersion)**: Variance, Std Dev, CV%
- **Екстремни стойности (Extremes)**: Min, Max, Range

---

## Analytics Tab Features

### 1. Performance Insights Cards (3 Cards)

#### Best Performer Card (Green gradient)
- 🏆 Trophy icon
- Mill name in large text
- Performance score (0-100)
- Stability percentage
- Trend indicator with emoji

#### Average Performance Card (Blue gradient)
- 📊 Chart icon
- Average score across all mills
- Total mill count
- Count of high performers (>80)
- Count of low performers (<60)

#### Needs Attention Card (Orange/Red gradient)
- ⚠️ Warning icon
- Worst performing mill
- Performance score
- Number of issues
- Anomaly count

### 2. Performance Ranking
- Top 6 mills ranked by performance score
- Each entry shows:
  - Rank number (1-6) in blue circle
  - Mill name (Bulgarian)
  - Mean value and stability
  - Color-coded score badge:
    - Green: ≥70
    - Yellow: 50-69
    - Red: <50
  - Trend emoji (📈/➡️/📉)

### 3. Anomaly Detection
- Real-time anomaly alerts using statistical analysis
- Detects values beyond 2σ (standard deviations)
- Severity levels:
  - 🔴 High (>3σ) - Red background
  - ⚠️ Medium (2.5-3σ) - Yellow background
  - ℹ️ Low (2-2.5σ) - Blue background
- Shows:
  - Mill name
  - Value and unit
  - Deviation in sigma (σ)
  - Timestamp
- Empty state: ✅ "No anomalies detected"

### 4. Correlation Analysis
- Pearson correlation between mill pairs
- Only shows significant correlations (|r| > 0.5)
- Top 5 correlations displayed
- Visual representation:
  - Positive correlation: Green bar
  - Negative correlation: Red bar
  - Bar width = correlation strength
- Strength classification:
  - Very strong: >0.8
  - Strong: 0.6-0.8
  - Moderate: 0.5-0.6

### 5. Optimization Recommendations
- Up to 4 mills with actionable recommendations
- Each card shows:
  - 💡 Lightbulb icon
  - Mill name
  - List of recommendations based on:
    - Stability issues
    - Declining trends
    - High variation
  - Identified problems section with ⚠️ icons

---

## Calculation Logic

### Performance Score (0-100)
```
Base Score = 100 - (stability * 2)
If trend = improving: +10 bonus
If trend = declining: -10 penalty
Final Score = clamp(0, 100)
```

### Stability Calculation
```
Stability = (Standard Deviation / Mean) * 100
```

### Trend Detection
```
First Half Mean vs Second Half Mean
If change > 2%: Improving
If change < -2%: Declining
Else: Stable
```

### Anomaly Detection
```
For each value:
  deviation = |value - mean| / stdDev
  If deviation > 3σ: High severity
  If deviation > 2.5σ: Medium severity
  If deviation > 2σ: Low severity
```

### Correlation (Pearson)
```
r = Σ[(xi - x̄)(yi - ȳ)] / √[Σ(xi - x̄)² * Σ(yi - ȳ)²]
Only show if |r| > 0.5
```

---

## Design Principles

### Color Scheme
- **Statistics Tab**: Professional, data-focused
  - Blue (#3b82f6) - Primary data
  - Green (#10b981) - Positive metrics
  - Orange (#f97316) - Variation metrics
  - Purple (#8b5cf6) - Statistical measures
  - Red (#ef4444) - Minimums/Issues
  - Emerald (#10b981) - Maximums

- **Analytics Tab**: Action-oriented gradients
  - Green gradients - Best performers
  - Blue gradients - Average/neutral
  - Orange/Red gradients - Needs attention
  - Color-coded badges for quick scanning

### Layout
- **Responsive grid system**: 1-4 columns based on screen size
- **Card-based design**: Consistent with existing tabs
- **Scrollable content**: Handles large datasets
- **Visual hierarchy**: Important metrics emphasized

### Typography
- **Headers**: Bold, 2xl for main titles
- **Metrics**: Large (2xl-3xl) for key numbers
- **Labels**: Small, uppercase for categories
- **Body text**: Regular size for details

### Icons & Emojis
- Used strategically for quick visual recognition
- Trend indicators: 📈 📉 ➡️
- Status indicators: 🏆 ⚠️ ✅ 🔴 ℹ️
- Category icons: 💡 📊

---

## User Benefits

### Statistics Tab
1. **Comprehensive overview** of parameter distribution
2. **Quick identification** of outliers via box plot
3. **Mill stability comparison** at a glance
4. **Trend awareness** for each mill
5. **Statistical literacy** - all key metrics in one place

### Analytics Tab
1. **Actionable insights** - not just data
2. **Performance ranking** - competitive view
3. **Proactive anomaly detection** - catch issues early
4. **Correlation discovery** - understand mill relationships
5. **Specific recommendations** - what to do next

---

## Technical Implementation

### Files Modified
- `src/app/analytics/components/StatisticsTab.tsx` - Complete rewrite (499 lines)
- `src/app/analytics/components/AnalyticsTab.tsx` - Complete rewrite (520 lines)
- `src/app/analytics/page.tsx` - Updated to pass rawData to new tabs

### Dependencies
- React useMemo for performance optimization
- Existing parameter selector utilities
- Mills tags for Bulgarian names
- No additional external libraries required

### Performance Considerations
- All calculations memoized with useMemo
- Efficient single-pass algorithms
- Limited display items (top 6, top 5, etc.)
- Responsive to data changes only

---

## Future Enhancements

### Potential Additions
1. **Export functionality** - Download statistics as PDF/Excel
2. **Historical comparison** - Compare current vs previous periods
3. **Predictive analytics** - Forecast future values
4. **Custom alerts** - User-defined thresholds
5. **Drill-down views** - Click for detailed mill analysis
6. **Parameter relationships** - Multi-parameter correlation matrix
7. **Benchmark mode** - Compare against targets/standards
8. **Mobile optimization** - Touch-friendly interactions

---

## Testing Recommendations

### Test Cases
1. **Empty data** - Verify graceful handling
2. **Single mill** - Ensure calculations work
3. **All mills identical** - Check edge cases
4. **Extreme values** - Anomaly detection accuracy
5. **Time range changes** - Data refresh
6. **Parameter switching** - Correct recalculation

### Visual Testing
1. Verify Bulgarian text rendering
2. Check responsive breakpoints
3. Confirm color accessibility
4. Test scroll behavior
5. Validate emoji display across browsers

---

## Conclusion

Both tabs now provide **production-ready**, **visually appealing**, and **highly functional** analytics capabilities that match and enhance the existing Analytics page design. The implementation focuses on:

- ✅ **Actionable insights** over raw data
- ✅ **Visual clarity** with color coding
- ✅ **Performance optimization** with memoization
- ✅ **User-friendly** Bulgarian interface
- ✅ **Comprehensive coverage** of statistical and analytical needs

The Statistics and Analytics tabs transform the Analytics page from a simple comparison tool into a **complete business intelligence platform** for mill operations.
