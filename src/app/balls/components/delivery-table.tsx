"use client";

import type { DeliveryRow } from "../lib/types";

type DeliveryTableProps = {
  rows: DeliveryRow[];
};

export function DeliveryTable({ rows }: DeliveryTableProps) {
  const normalRows = rows.filter((r) => !r.isDosmilane);
  const dosmilaneRows = rows.filter((r) => r.isDosmilane);

  const renderSection = (title: string, sectionRows: DeliveryRow[]) => {
    const totalKg = sectionRows.reduce(
      (sum, r) => sum + (Number(r.weight) || 0),
      0
    );
    const totalTonnes = totalKg / 1000;

    const totalsLine = (
      <div className="text-left sm:text-right whitespace-normal sm:whitespace-nowrap text-sm sm:text-base font-semibold text-gray-700">
        <span className="font-extrabold text-gray-900">
          {sectionRows.length}
        </span>{" "}
        записа, общо:{" "}
        <span className="font-extrabold text-gray-900">
          {totalTonnes.toFixed(2)}
        </span>{" "}
        t
      </div>
    );

    return (
      <div>
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800">{title}</div>
        </div>

        {sectionRows.length === 0 ? (
          <>
            <div className="px-4 py-8 text-sm text-gray-500 text-center bg-white">
              Няма данни
            </div>
            <div className="bg-gray-50 border-t border-gray-200 px-4 py-2">
              {totalsLine}
            </div>
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[150px]" />
                  <col className="w-[40px]" />
                  <col className="w-[52px]" />
                  <col className="w-[120px]" />
                  <col className="w-[90px]" />
                  <col className="w-[110px]" />
                </colgroup>
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                      Дата / Час
                    </th>
                    <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                      См
                    </th>
                    <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                      МШЦ
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                      Вид топки
                    </th>
                    <th className="px-2 py-2 text-right text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                      Тегло [кг.]
                    </th>
                    <th className="px-2 py-2 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                      Оператор
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sectionRows.map((row, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {row.date}
                      </td>
                      <td className="px-2 py-2 text-center whitespace-nowrap text-xs text-gray-700">
                        {row.shift}
                      </td>
                      <td className="px-2 py-2 text-center whitespace-nowrap text-xs text-gray-700">
                        {row.target}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-700">
                        <span className="block truncate" title={row.type}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap text-xs font-semibold text-gray-900">
                        {row.weight.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700">
                        {row.operator}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 border-t border-gray-200 px-4 py-2">
              {totalsLine}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden bg-white">
      <div className="divide-y divide-gray-200">
        {renderSection("Мелнично", normalRows)}
        {renderSection("Досмилане", dosmilaneRows)}
      </div>
    </div>
  );
}
