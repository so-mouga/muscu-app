export default function Interrupteur({ on, onChange, label, aide }: { on: boolean; onChange: (v: boolean) => void; label: string; aide?: string }) {
  return (
    <button type="button" className={'interrupteur' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span>
        {label}
        {aide && <div className="faible">{aide}</div>}
      </span>
      <span className="piste" />
    </button>
  )
}
