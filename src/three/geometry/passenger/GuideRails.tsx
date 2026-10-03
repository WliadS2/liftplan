import { Line } from '@react-three/drei'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type { PassengerGuideRailModel } from './passenger-installation-model'

export interface GuideRailsProps {
  readonly guideRails: PassengerGuideRailModel
}

export function GuideRails({ guideRails }: GuideRailsProps) {
  return (
    <group>
      {guideRails.xPositions.map((x) => (
        <Line
          key={x}
          color={TECHNICAL_MATERIALS.guideRail}
          lineWidth={1.5}
          points={[
            [x, guideRails.bottomY, guideRails.z],
            [x, guideRails.topY, guideRails.z],
          ]}
        />
      ))}
    </group>
  )
}
