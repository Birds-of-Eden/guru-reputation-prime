// app/[role]/qc/qc-review/page.tsx

"use client";
import { Suspense, lazy, Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Lazy load the heavy QCReview component
const QCReview = lazy(() => 
  import("../../qc_tasks/QCReview").then(module => ({ 
    default: module.QCReview 
  }))
);

// Optimized loading skeleton
function QCReviewSkeleton() {
  return (
    <div className="mx-auto w-full p-6 space-y-6 bg-gradient-to-br from-slate-50 via-white to-slate-50 min-h-screen">
      {/* Header skeleton */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-4 w-64 bg-slate-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded animate-pulse"></div>
      </div>
      
      {/* Filter skeleton */}
      <div className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-200 rounded animate-pulse"></div>
          ))}
        </div>
        <div className="h-10 bg-slate-200 rounded animate-pulse"></div>
      </div>
      
      {/* Content skeleton */}
      <div className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl rounded-2xl p-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Custom Error Boundary class
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('QC Review Error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }
      return <ErrorFallback error={this.state.error} resetErrorBoundary={this.resetError} />;
    }
    return this.props.children;
  }
}

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="mx-auto w-full p-6 min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md">
        <div className="p-4 bg-red-50 rounded-2xl">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Something went wrong</h2>
          <p className="text-slate-600">Failed to load QC Review page. Please try again.</p>
          <details className="text-sm text-slate-500 mt-2">
            <summary className="cursor-pointer">Error details</summary>
            <pre className="mt-2 p-2 bg-slate-100 rounded text-xs overflow-auto">
              {error.message}
            </pre>
          </details>
        </div>
        <Button 
          onClick={resetErrorBoundary}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<QCReviewSkeleton />}>
        <QCReview />
      </Suspense>
    </ErrorBoundary>
  );
}
