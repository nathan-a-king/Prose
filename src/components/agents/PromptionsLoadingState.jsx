/**
 * PromptionsLoadingState - Skeleton UI for loading state
 * Displays animated placeholders while options are being generated
 */
export default function PromptionsLoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin-gpu"
        ></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Generating options...</p>
      </div>

      {/* Skeleton controls */}
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col gap-2">
            {/* Label skeleton */}
            <div className="h-4 bg-gray-200 dark:bg-neutral-700 rounded w-1/4"></div>
            {/* Control skeleton */}
            <div className="h-10 bg-gray-200 dark:bg-neutral-700 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  )
}
