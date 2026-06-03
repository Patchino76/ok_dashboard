"use client";

import React, { useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkPlus,
  Bot,
  ChevronDown,
  LayoutTemplate,
  Send,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useChatStore } from "../stores/chat-store";
import { useUserPrompts, UserPrompt } from "../hooks/useUserPrompts";

// ── Suggested prompts ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  {
    label: "Сравнение на мелници",
    prompt:
      "Сравни средното натоварване по руда на всички мелници за последните 72 часа. Генерирай сравнителни графики и хистограми.",
  },
  {
    label: "Анализ на Мелница 8",
    prompt:
      "Направи пълен анализ на Мелница 8 за последните 30 дни — EDA, SPC контролни карти за PSI80 и Ore, корелации и аномалии.",
  },
  {
    label: "Престои",
    prompt:
      "Анализирай престоите на всички мелници за последните 7 дни. Покажи периодите с Ore < 10 т/ч и дай препоръки.",
  },
  {
    label: "Качество на смилане",
    prompt:
      "Анализирай качеството на смилане (PSI80, PSI200) за Мелница 6 и Мелница 8 за последните 14 дни. Сравни ги графично.",
  },
];

const TEMPLATES = [
  {
    id: "comprehensive",
    label: "Пълен анализ",
    desc: "EDA + аномалии + сменен отчет",
    cls: "border-indigo-200 bg-indigo-50/50 hover:border-indigo-400",
  },
  {
    id: "forecast",
    label: "Прогноза",
    desc: "EDA + прогнозиране на трендове",
    cls: "border-violet-200 bg-violet-50/50 hover:border-violet-400",
  },
  {
    id: "quality",
    label: "Качество",
    desc: "PSI анализ + SPC + оптимизация",
    cls: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400",
  },
  {
    id: "shift_comparison",
    label: "Смени",
    desc: "KPI по смени и сравнение",
    cls: "border-amber-200 bg-amber-50/50 hover:border-amber-400",
  },
  {
    id: "anomaly_investigation",
    label: "Аномалии",
    desc: "Детекция + Bayesian причини",
    cls: "border-rose-200 bg-rose-50/50 hover:border-rose-400",
  },
  {
    id: "optimization",
    label: "Оптимизация",
    desc: "Pareto + чувствителност",
    cls: "border-cyan-200 bg-cyan-50/50 hover:border-cyan-400",
  },
];

// ── Add / Edit Prompt Dialog ─────────────────────────────────────────────
function AddPromptDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, description: string) => void;
  initial?: { title: string; description: string };
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDesc(initial?.description ?? "");
    }
  }, [open, initial]);

  if (!open) return null;

  const canSave = title.trim().length > 0 && desc.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {initial ? "Редакция на промпт" : "Нов промпт"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Заглавие
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="напр. Анализ на Мелница 6"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Промпт
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Опишете какво трябва да анализират агентите..."
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Отказ
          </button>
          <button
            onClick={() => {
              if (canSave) {
                onSave(title.trim(), desc.trim());
                onClose();
              }
            }}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Запази
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Collapsible user prompt card ────────────────────────────────────────────
function UserPromptCard({
  prompt: p,
  onUse,
  onDelete,
}: {
  prompt: UserPrompt;
  onUse: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative text-left px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:border-amber-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 group-hover:text-amber-700">
          {p.title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex-shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 text-gray-300 hover:text-red-500 transition-all"
          title="Изтрий"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <p
        className={`text-xs text-gray-400 mt-1 cursor-pointer ${expanded ? "" : "line-clamp-2"}`}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? "Свий" : "Разгъни"}
      >
        {p.description}
      </p>

      {expanded && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200/60">
          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronDown className="w-3 h-3 inline mr-0.5 rotate-180" />
            Свий
          </button>
          <button
            onClick={onUse}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <Send className="w-3 h-3" />
            Използвай
          </button>
        </div>
      )}

      {!expanded && (
        <button
          onClick={onUse}
          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/80 text-white hover:bg-amber-600 transition-colors"
        >
          <Send className="w-3 h-3" />
          Използвай
        </button>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
export default function EmptyState() {
  const isLoading = useChatStore((s) => s.isLoading);
  const sendAnalysis = useChatStore((s) => s.sendAnalysis);
  const { prompts: userPrompts, createPrompt, deletePrompt } = useUserPrompts();
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);

  const handleSuggestion = (prompt: string, templateId?: string) => {
    if (isLoading) return;
    sendAnalysis(prompt, templateId);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
      <div>
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
          <Bot className="w-9 h-9 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">
          Какво искате да анализирам?
        </h2>
        <p className="text-sm text-gray-500 max-w-md">
          Задайте въпрос за мелничните данни. AI агентите ще заредят данни,
          направят анализ, генерират графики и напишат доклад.
        </p>
      </div>

      {/* Built-in suggestions */}
      <div className="w-full max-w-2xl">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          <Star className="w-3 h-3 inline mr-1 -mt-0.5" />
          Примерни анализи
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSuggestion(s.prompt)}
              className="text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600">
                {s.label}
              </span>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                {s.prompt}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Analysis templates (2D) */}
      <div className="w-full max-w-2xl">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          <LayoutTemplate className="w-3 h-3 inline mr-1 -mt-0.5" />
          Шаблони за анализ
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => {
                const prompt = window.prompt(
                  `Шаблон: ${tpl.label}\n\nВъведете въпрос (напр. "Анализирай Мелница 8 за последните 7 дни"):`,
                  "",
                );
                if (prompt?.trim()) handleSuggestion(prompt.trim(), tpl.id);
              }}
              disabled={isLoading}
              className={`text-left px-3 py-2.5 rounded-lg border ${tpl.cls} hover:shadow-md transition-all group disabled:opacity-50`}
            >
              <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900">
                {tpl.label}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">{tpl.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* User-saved prompts */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <Bookmark className="w-3 h-3 inline mr-1 -mt-0.5" />
            Моите промптове
          </h3>
          <button
            onClick={() => setPromptDialogOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            Добави
          </button>
        </div>

        {userPrompts.length === 0 ? (
          <button
            onClick={() => setPromptDialogOpen(true)}
            className="w-full px-4 py-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all flex flex-col items-center gap-1"
          >
            <BookmarkPlus className="w-5 h-5" />
            <span className="text-xs">Запазете промпт за бърз достъп</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {userPrompts.map((p) => (
              <UserPromptCard
                key={p.id}
                prompt={p}
                onUse={() => handleSuggestion(p.description)}
                onDelete={() => deletePrompt(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Prompt Dialog */}
      <AddPromptDialog
        open={promptDialogOpen}
        onClose={() => setPromptDialogOpen(false)}
        onSave={(title, description) => createPrompt({ title, description })}
      />
    </div>
  );
}
