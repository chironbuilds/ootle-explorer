// Renders a template function's `arg_type`/`output` shape as a Rust-like type name. The shape is
// a bare string for a builtin ("U8", "Unit", "&self", ...) or a single-key tagged object wrapping
// another shape -- `{Other:{name}}` for a named type, `{Option:T}`/`{Vec:T}` for a wrapper.
export function formatArgType(t: unknown): string {
  if (typeof t === "string") return t;
  if (t && typeof t === "object") {
    if ("Other" in t) return formatArgType((t as { Other: { name: string } }).Other.name);
    if ("Option" in t) return `${formatArgType((t as { Option: unknown }).Option)}?`;
    if ("Vec" in t) return `${formatArgType((t as { Vec: unknown }).Vec)}[]`;
  }
  return "unknown";
}
