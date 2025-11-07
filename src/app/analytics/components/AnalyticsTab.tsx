"use client";
import React, { useMemo } from "react";
import { getParameterByValue } from "./ParameterSelector";
import { millsNames } from "@/lib/tags/mills-tags";

interface AnalyticsTabProps {
  parameter: string;
  timeRange: string;
  millsData: any;
}

interface MillPerformance {
  millName: string;
  score: number; // 0-100
  mean: number;
  stability: number;
  trend: 'improving' | 'declining' | 'stable';
  rank: number;
  issues: string[];
  recommendations: string[];
}

interface Anomaly {
  millName: string;
  timestamp: string;
  value: number;
  severity: 'low' | 'medium' | 'high';
  deviation: number;
}

interface CorrelationData {
  mill1: string;
  mill2: string;
  correlation: number;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ parameter, timeRange, millsData }) => {
  const parameterInfo = getParameterByValue(parameter);
  
  // Calculate mill performance scores
  const millPerformances = useMemo((): MillPerformance[] => {
    if (!millsData?.data || millsData.data.length === 0) return [];
    
    const millValues: Record<string, number[]> = {};
    
    // Collect values per mill
    millsData.data.forEach((record: any) => {
      Object.keys(record).forEach(key => {
        if (key !== 'timestamp' && key !== 'parameter' && key !== 'freq') {
          const value = parseFloat(record[key]);
          if (!isNaN(value)) {
            if (!millValues[key]) millValues[key] = [];
            millValues[key].push(value);
          }
        }
      });
    });
    
    // Calculate performance metrics for each mill
    const performances = Object.entries(millValues).map(([millName, values]) => {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      const stability = mean !== 0 ? (stdDev / mean) * 100 : 0;
      
      // Calculate trend
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstMean = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondMean = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      const change = ((secondMean - firstMean) / firstMean) * 100;
      
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (change > 2) trend = 'improving';
      else if (change < -2) trend = 'declining';
      
      // Calculate performance score (0-100)
      // Lower stability = higher score, positive trend = bonus
      let score = Math.max(0, 100 - stability * 2);
      if (trend === 'improving') score += 10;
      if (trend === 'declining') score -= 10;
      score = Math.min(100, Math.max(0, score));
      
      // Identify issues
      const issues: string[] = [];
      if (stability > 20) issues.push('Висока нестабилност');
      if (trend === 'declining') issues.push('Влошаваща се тенденция');
      if (stdDev > mean * 0.3) issues.push('Голяма вариация');
      
      // Generate recommendations
      const recommendations: string[] = [];
      if (stability > 15) recommendations.push('Проверете настройките за стабилизиране');
      if (trend === 'declining') recommendations.push('Анализирайте причините за спада');
      if (issues.length === 0) recommendations.push('Поддържайте текущите параметри');
      
      return {
        millName,
        score: Number(score.toFixed(1)),
        mean: Number(mean.toFixed(2)),
        stability: Number(stability.toFixed(2)),
        trend,
        rank: 0, // Will be set after sorting
        issues,
        recommendations
      };
    });
    
    // Sort by score and assign ranks
    performances.sort((a, b) => b.score - a.score);
    performances.forEach((perf, index) => {
      perf.rank = index + 1;
    });
    
    return performances;
  }, [millsData]);
  
  // Detect anomalies
  const anomalies = useMemo((): Anomaly[] => {
    if (!millsData?.data || millsData.data.length === 0) return [];
    
    const detectedAnomalies: Anomaly[] = [];
    const millStats: Record<string, { mean: number; stdDev: number }> = {};
    
    // First pass: calculate statistics
    const millValues: Record<string, number[]> = {};
    millsData.data.forEach((record: any) => {
      Object.keys(record).forEach(key => {
        if (key !== 'timestamp' && key !== 'parameter' && key !== 'freq') {
          const value = parseFloat(record[key]);
          if (!isNaN(value)) {
            if (!millValues[key]) millValues[key] = [];
            millValues[key].push(value);
          }
        }
      });
    });
    
    Object.entries(millValues).forEach(([mill, values]) => {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      millStats[mill] = { mean, stdDev: Math.sqrt(variance) };
    });
    
    // Second pass: detect anomalies (values beyond 2 standard deviations)
    millsData.data.forEach((record: any) => {
      Object.keys(record).forEach(key => {
        if (key !== 'timestamp' && key !== 'parameter' && key !== 'freq' && millStats[key]) {
          const value = parseFloat(record[key]);
          if (!isNaN(value)) {
            const { mean, stdDev } = millStats[key];
            const deviation = Math.abs(value - mean) / stdDev;
            
            if (deviation > 2) {
              let severity: 'low' | 'medium' | 'high' = 'low';
              if (deviation > 3) severity = 'high';
              else if (deviation > 2.5) severity = 'medium';
              
              detectedAnomalies.push({
                millName: key,
                timestamp: record.timestamp,
                value: Number(value.toFixed(2)),
                severity,
                deviation: Number(deviation.toFixed(2))
              });
            }
          }
        }
      });
    });
    
    // Return only the most recent 10 anomalies
    return detectedAnomalies.slice(-10);
  }, [millsData]);
  
  // Calculate correlations between mills
  const correlations = useMemo((): CorrelationData[] => {
    if (!millsData?.data || millsData.data.length === 0) return [];
    
    const millValues: Record<string, number[]> = {};
    
    // Collect values per mill
    millsData.data.forEach((record: any) => {
      Object.keys(record).forEach(key => {
        if (key !== 'timestamp' && key !== 'parameter' && key !== 'freq') {
          const value = parseFloat(record[key]);
          if (!isNaN(value)) {
            if (!millValues[key]) millValues[key] = [];
            millValues[key].push(value);
          }
        }
      });
    });
    
    const mills = Object.keys(millValues);
    const correlationResults: CorrelationData[] = [];
    
    // Calculate Pearson correlation for each pair
    for (let i = 0; i < mills.length; i++) {
      for (let j = i + 1; j < mills.length; j++) {
        const values1 = millValues[mills[i]];
        const values2 = millValues[mills[j]];
        
        const n = Math.min(values1.length, values2.length);
        if (n < 2) continue;
        
        const mean1 = values1.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
        const mean2 = values2.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
        
        let numerator = 0;
        let denom1 = 0;
        let denom2 = 0;
        
        for (let k = 0; k < n; k++) {
          const diff1 = values1[k] - mean1;
          const diff2 = values2[k] - mean2;
          numerator += diff1 * diff2;
          denom1 += diff1 * diff1;
          denom2 += diff2 * diff2;
        }
        
        const correlation = numerator / Math.sqrt(denom1 * denom2);
        
        if (!isNaN(correlation) && Math.abs(correlation) > 0.5) {
          correlationResults.push({
            mill1: mills[i],
            mill2: mills[j],
            correlation: Number(correlation.toFixed(3))
          });
        }
      }
    }
    
    // Sort by absolute correlation value
    return correlationResults.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 5);
  }, [millsData]);
  
  if (!millsData?.data || millsData.data.length === 0) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">Няма налични данни за аналитичен преглед</p>
      </div>
    );
  }
  
  const bestPerformer = millPerformances[0];
  const worstPerformer = millPerformances[millPerformances.length - 1];
  
  return (
    <div className="h-full flex flex-col overflow-auto p-6 bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Разширена аналитика</h2>
        <p className="text-sm text-gray-600 mt-1">
          {parameterInfo?.label || parameter} • {timeRange === "24h" ? "24 Часа" : timeRange === "7d" ? "7 Дни" : "30 Дни"}
        </p>
      </div>
      
      {/* Performance Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Best Performer */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase">Най-добра мелница</h3>
            <span className="text-2xl">🏆</span>
          </div>
          <div className="text-3xl font-bold text-green-700 mb-2">
            {millsNames[parseInt(bestPerformer?.millName.replace(/\D/g, '')) - 1]?.bg || bestPerformer?.millName}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Резултат:</span>
              <span className="font-semibold text-green-700">{bestPerformer?.score}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Стабилност:</span>
              <span className="font-semibold">{bestPerformer?.stability.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Тренд:</span>
              <span className="font-semibold">
                {bestPerformer?.trend === 'improving' && '📈 Подобрява се'}
                {bestPerformer?.trend === 'stable' && '➡️ Стабилен'}
                {bestPerformer?.trend === 'declining' && '📉 Влошава се'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Average Performance */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase">Средна ефективност</h3>
            <span className="text-2xl">📊</span>
          </div>
          <div className="text-3xl font-bold text-blue-700 mb-2">
            {(millPerformances.reduce((sum, p) => sum + p.score, 0) / millPerformances.length).toFixed(1)}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Общо мелници:</span>
              <span className="font-semibold">{millPerformances.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Над 80 резултат:</span>
              <span className="font-semibold">{millPerformances.filter(p => p.score > 80).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Под 60 резултат:</span>
              <span className="font-semibold text-orange-600">{millPerformances.filter(p => p.score < 60).length}</span>
            </div>
          </div>
        </div>
        
        {/* Needs Attention */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase">Изисква внимание</h3>
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="text-3xl font-bold text-orange-700 mb-2">
            {millsNames[parseInt(worstPerformer?.millName.replace(/\D/g, '')) - 1]?.bg || worstPerformer?.millName}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Резултат:</span>
              <span className="font-semibold text-orange-700">{worstPerformer?.score}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Проблеми:</span>
              <span className="font-semibold text-red-600">{worstPerformer?.issues.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Аномалии:</span>
              <span className="font-semibold">{anomalies.filter(a => a.millName === worstPerformer?.millName).length}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Performance Ranking */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Класиране по ефективност</h3>
          <div className="space-y-3">
            {millPerformances.slice(0, 6).map((perf, index) => {
              const millNumber = parseInt(perf.millName.replace(/\D/g, ''));
              const displayName = millsNames[millNumber - 1]?.bg || perf.millName;
              
              let scoreColor = 'bg-green-500';
              if (perf.score < 70) scoreColor = 'bg-yellow-500';
              if (perf.score < 50) scoreColor = 'bg-red-500';
              
              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                    {perf.rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{displayName}</div>
                    <div className="text-xs text-gray-500">
                      Средно: {perf.mean} • Стабилност: {perf.stability.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className={`px-3 py-1 rounded-full text-white font-bold text-sm ${scoreColor}`}>
                      {perf.score}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-xl">
                    {perf.trend === 'improving' && '📈'}
                    {perf.trend === 'stable' && '➡️'}
                    {perf.trend === 'declining' && '📉'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Anomaly Detection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Откриване на аномалии</h3>
          {anomalies.length > 0 ? (
            <div className="space-y-2">
              {anomalies.slice(0, 6).map((anomaly, index) => {
                const millNumber = parseInt(anomaly.millName.replace(/\D/g, ''));
                const displayName = millsNames[millNumber - 1]?.bg || anomaly.millName;
                
                let severityColor = 'bg-yellow-100 text-yellow-800 border-yellow-300';
                let severityIcon = '⚠️';
                if (anomaly.severity === 'high') {
                  severityColor = 'bg-red-100 text-red-800 border-red-300';
                  severityIcon = '🔴';
                } else if (anomaly.severity === 'low') {
                  severityColor = 'bg-blue-100 text-blue-800 border-blue-300';
                  severityIcon = 'ℹ️';
                }
                
                return (
                  <div key={index} className={`p-3 rounded-lg border ${severityColor}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span>{severityIcon}</span>
                          <span className="font-semibold">{displayName}</span>
                        </div>
                        <div className="text-xs mt-1">
                          Стойност: {anomaly.value} {parameterInfo?.unit} • Отклонение: {anomaly.deviation}σ
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(anomaly.timestamp).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <div>Няма открити аномалии</div>
              <div className="text-xs mt-1">Всички стойности са в нормални граници</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Correlation Analysis */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Корелационен анализ</h3>
        <p className="text-sm text-gray-600 mb-4">
          Мелници с силна корелация (|r| {'>'} 0.5) - тенденцията им да се движат заедно
        </p>
        {correlations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {correlations.map((corr, index) => {
              const mill1Number = parseInt(corr.mill1.replace(/\D/g, ''));
              const mill2Number = parseInt(corr.mill2.replace(/\D/g, ''));
              const mill1Name = millsNames[mill1Number - 1]?.bg || corr.mill1;
              const mill2Name = millsNames[mill2Number - 1]?.bg || corr.mill2;
              
              const isPositive = corr.correlation > 0;
              const strength = Math.abs(corr.correlation);
              const barWidth = strength * 100;
              
              return (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-700">
                      {mill1Name} ↔ {mill2Name}
                    </div>
                    <div className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {corr.correlation > 0 ? '+' : ''}{corr.correlation}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {isPositive ? 'Положителна корелация' : 'Отрицателна корелация'} • 
                    {strength > 0.8 ? ' Много силна' : strength > 0.6 ? ' Силна' : ' Умерена'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Няма открити значими корелации между мелниците
          </div>
        )}
      </div>
      
      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Препоръки за оптимизация</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {millPerformances.filter(p => p.recommendations.length > 0).slice(0, 4).map((perf, index) => {
            const millNumber = parseInt(perf.millName.replace(/\D/g, ''));
            const displayName = millsNames[millNumber - 1]?.bg || perf.millName;
            
            return (
              <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-2xl">💡</div>
                  <div className="font-semibold text-gray-800">{displayName}</div>
                </div>
                <ul className="space-y-2">
                  {perf.recommendations.map((rec, recIndex) => (
                    <li key={recIndex} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
                {perf.issues.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Открити проблеми:</div>
                    {perf.issues.map((issue, issueIndex) => (
                      <div key={issueIndex} className="text-xs text-red-600 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
