export default function NotFound() {
  return (
    <div className="container mx-auto py-16 flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Страницата не е намерена</h2>
          <p className="text-gray-500 mb-6">
            Страницата, която се опитвате да достъпите, не съществува.
          </p>
          <a 
            href="/"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Към начална страница
          </a>
        </div>
      </div>
    </div>
  );
}
