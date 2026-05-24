import { Component, ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error(`[${this.props.label}] error:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#1a0610',
            color: '#fff',
            padding: 24,
            font: '12px monospace',
            zIndex: 9999,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          <h2 style={{ color: '#ff8080', fontFamily: 'serif', marginBottom: 12 }}>
            {this.props.label} crashed
          </h2>
          <div style={{ color: '#ffb' }}>{this.state.error.message}</div>
          <div style={{ marginTop: 12, opacity: 0.8 }}>{this.state.error.stack}</div>
          <button
            style={{ marginTop: 16 }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
