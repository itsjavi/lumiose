// @tsx className class default
// React with class markers: merged into static, computed, spread and missing `className`s, and
// passed to components that receive a `className` (class passthrough).
"use client";
import "/src/react-classes.stsx.css";

type Props = { className?: string; label: string; on?: boolean };

function Chip(props: Props) {
  return <span className={props.className}>{props.label}</span>;
}

export function Card(props: Props) {
  const rest = { id: "x" };
  return (
    <article className="card lum-1uwmhze1">
      <h2 className="lum-1uwmhze1">{props.label}</h2>
      <p className={[props.on ? "on" : undefined, "lum-1uwmhze1"].filter(Boolean).join(" ")}>computed</p>
      <p {...rest} className={[(rest)?.className, "lum-1uwmhze1"].filter(Boolean).join(" ")}>spread</p>
      <p className="lum-1uwmhze1" {...{ ...rest }}>complex spread</p>
      <p className="lum-1uwmhze1">bare</p>
      <Chip className="cta lum-1uwmhze1" label="passthrough" />
      <Chip label="no class: no passthrough" />
      
    </article>
  );
}
