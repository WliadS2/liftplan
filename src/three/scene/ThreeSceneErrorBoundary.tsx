import { Component, type ReactNode } from 'react'

export interface ThreeSceneErrorBoundaryProps {
  readonly children: ReactNode
}

interface ThreeSceneErrorBoundaryState {
  readonly hasError: boolean
}

export class ThreeSceneErrorBoundary extends Component<
  ThreeSceneErrorBoundaryProps,
  ThreeSceneErrorBoundaryState
> {
  public state: ThreeSceneErrorBoundaryState = { hasError: false }

  public static getDerivedStateFromError(): ThreeSceneErrorBoundaryState {
    return { hasError: true }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <section className="workspace-panel viewport-panel" role="alert">
          <h2>3D-Ansicht</h2>
          <div className="viewport-fallback">
            3D-Ansicht konnte nicht geladen werden.
          </div>
        </section>
      )
    }

    return this.props.children
  }
}
