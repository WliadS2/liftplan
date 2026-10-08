import type { CarrierDriveVisualization } from '../../simulation/carrier-drive-visualization'

export function CarrierDriveNotice({capability}:{readonly capability?:CarrierDriveVisualization}) {
  if (!capability || capability.concept === 'unspecified' ||
    ![capability.counterweight,capability.plunger,capability.suspension].includes('unknown')) return null
  return <p className="panel-note" role="status">
    Antriebsbewegung unvollständig – fehlende Bewegungsdaten werden nicht ergänzt.
    Statische Referenzhüllen bleiben sichtbar; Seilverläufe ohne vollständige Bewegungsdaten werden ausgelassen.
  </p>
}
