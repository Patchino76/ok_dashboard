"use client";

type BallsHeaderProps = {
  title: string;
  dateLabel: string;
};

export function BallsHeader({ title, dateLabel }: BallsHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-2">{dateLabel}</p>
    </div>
  );
}
