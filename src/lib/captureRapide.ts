import { fetchKv, readKvCache, saveKv } from './kv'

// Le bouton « + » flottant : capture express d'une note, d'une tâche ou d'un
// événement, avec dictée. Il est sur TOUTES les pages, et c'est là qu'il finit
// par gêner.
//
// ── Un réglage plutôt qu'une suppression ────────────────────────────────────
//
// « Je ne l'utilise jamais » est vrai pour celui qui le dit, et pas forcément
// pour les autres comptes : la capture rapide sert surtout à qui vit dans
// l'agenda et les notes. Retirer le bouton du code le retirerait à tout le
// monde, sans que personne n'ait rien demandé.
//
// D'où un réglage par compte. Allumé par défaut : personne ne doit perdre un
// bouton parce que quelqu'un d'autre s'en passe.

export const CLE_CAPTURE = 'interface_capture_rapide'

/**
 * La valeur du cache, lue sans attendre le réseau.
 *
 * Sans ça, le bouton apparaîtrait à chaque ouverture de page puis
 * disparaîtrait une fraction de seconde plus tard — un clignotement à chaque
 * navigation, pour un réglage qui ne change jamais.
 */
export function captureRapideEnCache(): boolean {
  return readKvCache<boolean>(CLE_CAPTURE, true) !== false
}

export async function loadCaptureRapide(userId: string): Promise<boolean> {
  return (await fetchKv<boolean>(userId, CLE_CAPTURE, true)) !== false
}

export async function saveCaptureRapide(userId: string, on: boolean): Promise<boolean> {
  await saveKv(userId, CLE_CAPTURE, on)
  return on
}
