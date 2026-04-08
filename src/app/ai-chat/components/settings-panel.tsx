"use client";

import React, { useState } from "react";
import { Settings, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import {
  useSettingsStore,
  SETTING_OPTIONS,
  SETTING_LABELS,
  SETTING_DESCRIPTIONS,
  type AnalysisSettings,
} from "../stores/settings-store";

function SettingRow({
  settingKey,
}: {
  settingKey: keyof AnalysisSettings;
}) {
  const value = useSettingsStore((s) => s[settingKey]);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const options = SETTING_OPTIONS[settingKey];
  const label = SETTING_LABELS[settingKey];
  const description = SETTING_DESCRIPTIONS[settingKey];

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
          {description}
        </p>
      </div>
      <select
        value={value}
        onChange={(e) => updateSetting(settingKey, Number(e.target.value))}
        className="flex-shrink-0 w-24 px-2 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
      >
        {(options as readonly number[]).map((opt) => (
          <option key={opt} value={opt}>
            {opt.toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const resetDefaults = useSettingsStore((s) => s.resetDefaults);

  return (
    <div className="w-full max-w-4xl mx-auto mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors px-1"
      >
        <Settings className="w-3.5 h-3.5" />
        Настройки на анализа
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="divide-y divide-gray-100">
            <SettingRow settingKey="maxToolOutputChars" />
            <SettingRow settingKey="maxAiMessageChars" />
            <SettingRow settingKey="maxMessagesWindow" />
            <SettingRow settingKey="maxSpecialistIterations" />
          </div>

          <div className="flex justify-end mt-3 pt-2 border-t border-gray-100">
            <button
              onClick={resetDefaults}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              По подразбиране
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
