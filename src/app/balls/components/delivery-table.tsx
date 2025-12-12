"use client";

import type { DeliveryRow } from "../lib/mock-data";

type DeliveryTableProps = {
  rows: DeliveryRow[];
};

export function DeliveryTable({ rows }: DeliveryTableProps) {
  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Дата / Час
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                См
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                МШЦ
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Вид топки
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                Тегло [кг.]
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Оператор
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {row.date}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap text-sm text-gray-700">
                  {row.shift}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap text-sm text-gray-700">
                  {row.target}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  {row.type}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-sm font-semibold text-gray-900">
                  {row.weight.toFixed(2)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  {row.operator}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
