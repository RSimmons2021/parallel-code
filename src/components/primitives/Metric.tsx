import { Show, type JSX } from 'solid-js';

interface MetricProps {
  label: string;
  value: JSX.Element;
  sub?: JSX.Element;
  /** Override the value color (e.g. pass/fail thresholds). */
  tone?: string;
}

/**
 * Metric — an instrument readout: small-caps mono label over a large tabular
 * value, optional sub-line. The studio shows numbers like a device, not a form.
 */
export function Metric(props: MetricProps) {
  return (
    <div>
      <div class="in-metric__label">{props.label}</div>
      <div class="in-metric__value" style={{ color: props.tone }}>
        {props.value}
      </div>
      <Show when={props.sub}>
        <div class="in-metric__sub">{props.sub}</div>
      </Show>
    </div>
  );
}
