interface Source {
  canonical_id: string;
  paraphrase: string;
  school?: string;
}

interface ProvenancePanelProps {
  sources: Source[];
  confidence: number;
}

export default function ProvenancePanel({ sources, confidence }: ProvenancePanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
      <h2 className="text-xl font-semibold mb-4">Provenance & Sources</h2>

      {/* Confidence Badge */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600 mb-2">Overall Confidence</div>
        <div className="flex items-center">
          <div className="flex-1 bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${
                confidence >= 0.8
                  ? 'bg-green-500'
                  : confidence >= 0.6
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className="ml-3 text-lg font-bold">
            {(confidence * 100).toFixed(0)}%
          </span>
        </div>
        {confidence < 0.7 && (
          <p className="mt-2 text-sm text-yellow-700">
            ⚠️ Scholar review recommended
          </p>
        )}
      </div>

      {/* Sources List */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Referenced Verses</h3>
        {sources.length === 0 && (
          <p className="text-gray-500 text-sm">No verses referenced</p>
        )}
        {sources.map((source, index) => (
          <div
            key={index}
            className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded-r"
          >
            <div className="font-mono text-sm font-semibold text-red-700">
              {source.canonical_id}
            </div>
            <p className="text-gray-700 text-sm mt-1">{source.paraphrase}</p>
            {source.school && (
              <div className="text-xs text-gray-500 mt-1">
                School: {source.school}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Attribution */}
      <div className="mt-6 pt-6 border-t text-xs text-gray-500">
        <p>
          All verses from the Bhagavad Geeta (public domain Sanskrit text).
          Interpretations based on traditional commentaries.
        </p>
      </div>
    </div>
  );
}
