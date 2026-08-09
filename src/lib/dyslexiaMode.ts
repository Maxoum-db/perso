import type { CSSProperties } from 'react'

// Mode dyslexie : ajustements recommandés par la British Dyslexia Association
// — police sans-serif large et bien distinguée (Verdana/Tahoma plutôt que le
// stack système par défaut), interlignage et espacement des lettres/mots
// augmentés, lignes plus courtes (mesure limitée), pas de majuscules
// forcées. Préférence d'appareil comme la taille du texte : locale,
// pas de sync Supabase.

const CLE = 'perso_dyslexia_mode'

export function readDyslexiaMode(): boolean {
  return localStorage.getItem(CLE) === '1'
}

export function writeDyslexiaMode(actif: boolean) {
  localStorage.setItem(CLE, actif ? '1' : '0')
}

const DYS_FONT = "Verdana, Tahoma, 'Trebuchet MS', Arial, sans-serif"

/** À poser sur le texte à lire (pas sur toute la page — juste le contenu). */
export function dysTextStyle(actif: boolean): CSSProperties {
  if (!actif) return {}
  return {
    fontFamily: DYS_FONT,
    lineHeight: 1.9,
    letterSpacing: '0.03em',
    wordSpacing: '0.14em',
  }
}
