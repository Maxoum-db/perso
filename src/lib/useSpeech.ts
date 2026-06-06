import { useCallback, useEffect, useRef, useState } from 'react'

// Dictée vocale via l'API Web Speech (Chrome, Android, Safari récent).
// Sur iPhone, le micro 🎤 du clavier reste le moyen le plus fiable : si l'API
// n'est pas dispo, le bouton est masqué et on s'appuie dessus.

type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: any) => void) | null
  onend: (() => void) | null
  onerror: ((e: any) => void) | null
}

function getRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

/**
 * @param onFinal appelé avec chaque segment de texte finalisé (à concaténer).
 */
export function useSpeech(onFinal: (text: string) => void) {
  const supported = !!getRecognitionCtor()
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRec | null>(null)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    try {
      const rec = new Ctor()
      rec.lang = 'fr-FR'
      rec.continuous = true
      rec.interimResults = false
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) onFinalRef.current(res[0].transcript)
        }
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recRef.current = rec
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [])

  useEffect(() => () => recRef.current?.stop(), [])

  return { supported, listening, start, stop }
}
