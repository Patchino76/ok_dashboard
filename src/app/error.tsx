'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto py-16 flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Нещо се обърка</h2>
          <p className="text-gray-500 mb-6">
            Възникна грешка при зареждането на тази страница.
          </p>
          <button
            onClick={() => reset()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Опитайте отново
          </button>
        </div>
      </div>
    </div>
  );
}
