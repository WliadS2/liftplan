import type {
  PassengerSpatialIssue,
  PassengerSpatialIssueCode,
  SpatialValidationStatus,
} from '../../collision/passenger-spatial-validation'

export const SPATIAL_STATUS_LABELS: Record<SpatialValidationStatus, string> = {
  ok: 'Geeignet',
  warning: 'Prüfung erforderlich',
  invalid: 'Nicht möglich',
  unknown: 'Noch nicht bewertet',
}

const messages: Record<PassengerSpatialIssueCode, string> = {
  'geometry-unavailable': 'Für die räumliche Prüfung fehlen Geometriedaten.',
  'levels-unavailable': 'Haltestellendaten fehlen. Die Ebenenfolge ist noch nicht bewertet.',
  'invalid-level-order': 'Die Haltestellenhöhen sind nicht eindeutig aufsteigend.',
  'level-outside-installation': 'Eine Haltestelle liegt außerhalb der angegebenen Installationshöhe.',
  'cabin-geometry-unavailable': 'Kabinenmaße fehlen. Die Kabinengeometrie ist noch nicht bewertet.',
  'invalid-cabin-dimensions': 'Die Kabinenmaße müssen endlich und größer als null sein.',
  'shaft-geometry-unavailable': 'Schachtdaten fehlen. Die räumliche Passung ist noch nicht bewertet.',
  'cabin-outside-shaft': 'Die Kabine überschreitet den angegebenen Schacht seitlich.',
  'cabin-travel-outside-shaft': 'Der Kabinenfahrbereich überschreitet die angegebene Schachthöhe.',
  'zero-geometric-clearance': 'Zwischen Kabine und Schacht liegt an mindestens einer Seite kein geometrischer Abstand vor.',
  'car-frame-unavailable': 'Tragrahmendaten fehlen. Die Rahmenpassung ist noch nicht bewertet.',
  'car-frame-outside-shaft': 'Der Tragrahmen überschreitet den angegebenen Schacht.',
  'invalid-frame-cabin-relationship': 'Tragrahmen und Kabine weisen einen geometrischen Konflikt auf.',
  'counterweight-layout-unavailable': 'Die Gegengewichtsanordnung ist noch nicht vollständig bewertet.',
  'counterweight-outside-shaft': 'Das Gegengewicht überschreitet den angegebenen Schacht.',
  'counterweight-travel-outside-shaft': 'Der Bewegungsraum des Gegengewichts überschreitet den angegebenen Schacht.',
  'counterweight-cabin-intersection': 'Kabine und Gegengewicht überschneiden sich geometrisch.',
  'rail-layout-unavailable': 'Führungsschienen oder Führungselemente sind noch nicht vollständig bewertet.',
  'collapsed-rail-pair': 'Ein Führungsschienenpaar liegt auf derselben Achse.',
  'rail-axis-outside-shaft': 'Eine Führungsschienenachse liegt außerhalb des angegebenen Schachts.',
  'guide-shoe-rail-mismatch': 'Ein Führungsschuh verweist nicht auf die vorgesehene Führungsschiene.',
  'door-data-unavailable': 'Kabinentürdaten fehlen. Die Türgeometrie ist noch nicht bewertet.',
  'landing-door-data-unavailable': 'Schachttürdaten fehlen. Die Türausrichtung ist noch nicht bewertet.',
  'invalid-door-geometry': 'Eine Türbaugruppe enthält nicht darstellbare Geometrie.',
  'missing-cabin-entrance': 'Eine Türbaugruppe verweist auf einen fehlenden Kabinenzugang.',
  'door-width-exceeds-cabin-entrance': 'Die angegebene Türbreite passt nicht in den Kabinenzugang.',
  'door-height-exceeds-cabin-entrance': 'Die angegebene Türhöhe passt nicht in den Kabinenzugang.',
  'door-panel-outside-entrance': 'Ein Türblatt liegt außerhalb des zugehörigen Zugangs.',
  'invalid-landing-level': 'Eine Schachttür ist keiner gültigen Haltestelle zugeordnet.',
  'door-axis-mismatch': 'Kabinen- und Schachttür liegen nicht auf derselben Zugangsachse.',
  'buffer-data-unavailable': 'Pufferdaten fehlen. Die Pufferanordnung ist noch nicht bewertet.',
  'buffer-outside-shaft': 'Eine Pufferbaugruppe liegt außerhalb des angegebenen Schachts.',
  'upper-mechanical-unavailable': 'Obere Mechanikdaten fehlen. Dieser Bereich ist noch nicht bewertet.',
  'mechanical-component-outside-shaft': 'Eine feste mechanische Baugruppe liegt außerhalb des angegebenen Schachts.',
  'counterweight-sweep-unavailable': 'Der Bewegungsraum des Gegengewichts ist noch nicht bewertet.',
  'counterweight-sweep-conflict': 'Die Bewegungsräume von Kabine und Gegengewicht überlagern sich geometrisch.',
  'fixed-obstacle-in-cabin-sweep': 'Eine feste Baugruppe liegt im Bewegungsraum der Kabine.',
}

export function getSpatialIssueMessage(issue: PassengerSpatialIssue): string {
  return messages[issue.code]
}
