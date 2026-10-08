export function Icon(props: { size?: number }) {
  const size = props.size ?? 24;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g">
          <stop offset="0" stop-color="#fff" />
        </linearGradient>
      </defs>
      <path d="M12 2 L22 22 L2 22 Z" fill="url(#g)" />
      <foreignObject width="10" height="10">
        <div>html inside svg</div>
      </foreignObject>
    </svg>
  );
}
