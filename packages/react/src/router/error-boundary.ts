import type { ComponentType, ReactNode } from "react"
import type { ErrorProps } from "./types.js"

import { Component, createElement } from "react"

interface ErrorBoundaryProps {
  fallback: ComponentType<ErrorProps>
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * @describe Catches render errors in its subtree and shows `fallback` with
 * `{ error, reset }`. Composed inside its sibling layout (ADR 0003 §3), so a
 * caught error never tears the layout down, and `reset()` only re-renders the
 * boundary's own contents.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (error) {
      return createElement(this.props.fallback, { error, reset: this.reset })
    }
    return this.props.children
  }
}
