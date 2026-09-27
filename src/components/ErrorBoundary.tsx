import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Pantry UI runtime error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div className="empty" style={{ margin: '0 auto', maxWidth: '440px' }}>
            <div className="food" style={{ margin: '0 auto 16px' }} aria-hidden="true">
              🫙
            </div>
            <h2>Something went wrong opening your pantry</h2>
            <p>
              {this.state.error?.message ||
                'An unexpected rendering issue occurred. You can reload your pantry safely.'}
            </p>
            <button className="primary" type="button" onClick={() => window.location.reload()}>
              Reload pantry
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
