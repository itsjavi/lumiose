import type { Handle, RemixNode } from "remix/component";

export function FieldError(handle: Handle<{ name: string; error: string | undefined }>) {
  return () => {
    const { name, error } = handle.props;
    if (!error) return null;
    return (
      <p class="field-error" id={`${name}-error`} data-testid={`error-${name}`}>
        {error}
      </p>
    );
  };
}

export function Field(
  handle: Handle<{ name: string; label: string; error?: string; children?: RemixNode }>,
) {
  return () => {
    const { name, label, error, children } = handle.props;
    return (
      <div class={error ? "field has-error" : "field"}>
        <label class="field-label" htmlFor={name}>
          {label}
        </label>
        {children}
        <FieldError name={name} error={error} />
      </div>
    );
  };
}
