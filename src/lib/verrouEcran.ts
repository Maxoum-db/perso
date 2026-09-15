// Le verrou d'écran, partagé par tout ce qui mesure en continu.
//
// Un téléphone verrouille son écran au bout d'une minute, met la page en
// arrière-plan, et TOUT s'arrête : les notifications Bluetooth du brassard
// comme les positions du GPS. Une mesure d'une heure serait donc perdue au bout
// d'une minute.
//
// On demande donc un verrou TANT QUE ça mesure, et on le rend en arrêtant :
// garder l'écran allumé coûte de la batterie, ça ne se fait pas « au cas où ».
//
// Extrait du capteur cardiaque le jour où le GPS a eu le même besoin. Deux
// copies de cette fonction auraient divergé, et celle qu'on n'aurait pas
// corrigée aurait laissé l'écran s'éteindre au milieu d'un trajet.

export interface Verrou {
  release: () => Promise<void>
}

type PorteVerrou = { current: Verrou | null }

/**
 * Demande le verrou, en silence.
 *
 * Absent d'un navigateur sur deux, refusé en arrière-plan, révoqué à
 * l'économiseur de batterie : tous ces cas sont normaux et aucun ne doit
 * interrompre une mesure. On essaie, et s'il n'y a pas de verrou, tant pis —
 * ça tiendra tant que l'écran reste allumé à la main.
 */
export async function prendreVerrou(ref: PorteVerrou): Promise<void> {
  if (ref.current) return
  const api = (navigator as unknown as { wakeLock?: { request(t: string): Promise<Verrou> } }).wakeLock
  if (!api) return
  try {
    ref.current = await api.request('screen')
  } catch {
    ref.current = null
  }
}

export function rendreVerrou(ref: PorteVerrou): void {
  ref.current?.release().catch(() => {})
  ref.current = null
}
