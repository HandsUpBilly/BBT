interface Props {
  probability: number;
  visible: boolean;
}

export function SuccessChanceReadout({ probability, visible }: Props) {
  return (
    <span
      className={`hud__success${visible ? '' : ' hud__success--placeholder'}`}
      aria-hidden={!visible}
    >
      <span className="hud__prob-label">Success chance</span>
      <span className={`hud__prob-value ${probability < 50 ? 'hud__prob-value--risky' : ''}`}>
        {probability}%
      </span>
    </span>
  );
}
