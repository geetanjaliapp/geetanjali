import { Link } from 'react-router-dom';

export default function Verses() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-center mb-6">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="Geetanjali" className="h-16 w-16" />
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Verse Browser</h1>
        <div className="bg-white rounded-lg shadow-md p-8">
          <p className="text-gray-600">Verse browser will be implemented here...</p>
        </div>
      </div>
    </div>
  );
}
