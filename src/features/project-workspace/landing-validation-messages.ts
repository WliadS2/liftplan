import type { LandingIssueCode } from '../../elevator/configuration/landing-planning'
export const LANDING_ISSUE_MESSAGES: Record<LandingIssueCode, string> = {
  'missing-elevation': 'Höhenposition fehlt. Es wird keine Höhe angenommen.',
  'invalid-elevation-order': 'Höhenpositionen müssen eindeutig aufsteigend sein.',
  'invalid-stop-count': 'Die Anzahl Haltestellen muss eine positive ganze Zahl sein.',
  'inconsistent-stop-references': 'Haltestellenanzahl, Höhenpositionen oder Referenzen sind nicht konsistent.',
  'unserved-stop': 'Die Haltestelle benötigt mindestens einen Zugang.',
  'unsupported-front-access': 'Für diesen Zugang muss die vordere Kabinen-/Plattformöffnung konfiguriert sein.',
  'unsupported-rear-access': 'Für diesen Zugang müssen Durchlader und hintere Kabinen-/Plattformöffnung konfiguriert sein.',
  'access-unavailable': 'Zugänge sind noch nicht vollständig angegeben.',
  'landing-door-shaft-conflict': 'Eine Haltestellenöffnung überschreitet die angegebene Schachtgeometrie.',
}
