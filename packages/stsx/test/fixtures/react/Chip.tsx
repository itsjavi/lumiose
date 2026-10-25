export function Chip(props: { className?: string; label: string }) {
  return <span className={props.className}>{props.label}</span>;
}
