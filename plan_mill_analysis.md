# Mills Analytics Page Plan

## Notes

- The page will provide summary statistics and analysis for 12 ball mills.
- Data is sourced from the endpoint: api/mills/all_mills_by_param.
- The user wants tabs for different types of analysis.
- The initial focus is a bar chart comparing mills by a selected parameter.
- Parameters include: Ore, WaterMill, WaterZumpf, Power, ZumpfLevel, PressureHC, DensityHC, PulpHC, PumpRPM, MotorAmp, PSI80, PSI200.
- There should be a list of parameter objects with English and Bulgarian names.
- Database schema for mills and parameters is confirmed.
- Backend API endpoint /api/mills/all_mills_by_param is implemented and matches requirements.

## Implementation Details

### 1. Frontend Structure

- Create a new page component for mills_analytics
- Implement a tab navigation system for different analysis types
- Create a parameter selection component with translations

### 2. UI Components

- Parameter selector dropdown with English/Bulgarian labels
- Time range selector (similar to the 24 Hours dropdown in the mockup)
- Bar chart component for mill comparison
- Statistics display for min/max/avg values

### 3. Data

- Define a parameter mapping with translations:

```javascript
const parameters = [
  { value: "Ore", label: "Ore", labelBg: "Руда" },
  { value: "WaterMill", label: "Water Mill", labelBg: "Вода мелница" },
  { value: "Power", label: "Power", labelBg: "Мощност" },
  // etc.
];
```

### 4. API Integration

- Use the existing `/api/mills/all_mills_by_param` endpoint
- Implement data fetching with selected parameter and time range
- Transform API response for use in charts and statistics

### 5. Initial Tabs for Analysis Types

- Mill Comparison (bar chart comparing mills)
- Trends (line chart showing parameter trends over time)
- Statistics (detailed statistical analysis)
- Analytics (more advanced analysis features)

## Task List

- [ ] Design mills_analytics page structure with tabs for analysis types
- [ ] Create and display a parameter selection list in the frontend
- [ ] Define parameter objects with English and Bulgarian translations
- [ ] Implement component to fetch data from api/mills/all_mills_by_param
- [ ] Build bar chart component for mill comparison by selected parameter

## Current Goal

Design mills_analytics page structure
