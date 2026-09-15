import { useEffect, useState } from 'react'
import { useCapteurCardio } from '../lib/capteurCardio'
import { fcMaxEstimee } from '../lib/cardio'
import { loadCardios, loadFcMaxRelevee, saveCardio } from '../lib/cardioSeance'
import { age, loadProfil, PROFIL_DEFAUT, type Profil } from '../lib/profil'
import { RESSENTI_NAME, saveSession } from '../lib/muscu'
import { CardioLive } from './CardioLive'
import { RessentiPicker } from './RessentiPicker'

// L'entraînement de béhourd, suivi au capteur.
//
// ── Pourquoi il ne passe pas par l'écran de musculation ─────────────────────
//
// Une séance de musculation est une liste d'exercices à cocher. Un
// entraînement de béhourd n'en est pas une : on ne compte ni les séries ni les
// charges, on encaisse et on frappe pendant quatre-vingt-dix minutes. Le faire
// entrer dans le moule des exercices obligerait à inventer des lignes
// (« mêlée · 3 × 10 »), c'est-à-dire à écrire des chiffres faux pour remplir un
// formulaire.
//
// Ce qu'on peut vraiment mesurer, c'est le TEMPS et le CŒUR. D'où cet écran :
// un chrono, la fréquence cardiaque, les zones — et à la fin les zones du corps
// qui ont pris, déclarées à la main.
//
// ── Ce qu'il enregistre ─────────────────────────────────────────────────────
//
// Une séance ordinaire du journal, avec une seule ligne : le ressenti. C'est
// déjà la façon dont un béhourd s'enregistrait à la main — on ne crée donc ni
// table ni format, et le mannequin, la récupération, les calories et l'export
// la lisent tous sans rien savoir du béhourd.

export function EntrainementBehourd({ userId, cardioActif }: { userId: string; cardioActif: boolean }) {
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT)
  const [fcMaxRelevee, setFcMaxRelevee] = useState<number | null>(null)
  const [debut, setDebut] = useState<number | null>(null)
  const [maintenant, setMaintenant] = useState(() => Date.now())
  const [zones, setZones] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    loadProfil(userId).then(setProfil).catch(() => {})
    loadFcMaxRelevee(userId).then(setFcMaxRelevee).catch(() => {})
  }, [userId])

  const fcMaxEstime = fcMaxEstimee(age(profil))
  const fcMax = fcMaxRelevee ?? fcMaxEstime
  const capteur = useCapteurCardio(fcMax)

  useEffect(() => {
    if (debut === null) return
    const t = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(t)
  }, [debut])

  const minutes = debut === null ? 0 : Math.max(1, Math.round((maintenant - debut) / 60000))

  function demarrer() {
    capteur.remettreAZero()
    setMsg(null)
    setDebut(Date.now())
    setMaintenant(Date.now())
  }

  /**
   * Termine et enregistre.
   *
   * La durée est MESURÉE, pas saisie : c'est elle qui fait les calories, et
   * c'est la seule chose qu'un chrono sait mieux que la mémoire d'après-coup.
   */
  async function terminer() {
    if (debut === null) return
    setBusy(true)
    setMsg(null)
    try {
      const id = await saveSession(
        userId,
        {
          date: new Date().toISOString().slice(0, 10),
          name: '🛡️ Béhourd',
          duration_min: minutes,
          notes: notes.trim(),
          template_id: null,
        },
        // Une seule ligne, celle du ressenti : c'est ainsi qu'une séance sans
        // série ni charge existe déjà dans le journal.
        [{ name: RESSENTI_NAME, muscle_group: zones, sets: 1, reps: '—', weight_kg: null, notes: '' }],
      )
      if (cardioActif && capteur.bilan) {
        try {
          await saveCardio(userId, id, capteur.bilan, capteur.nom, await loadCardios(userId))
        } catch {
          /* la séance est enregistrée, c'est elle qui compte */
        }
      }
      setDebut(null)
      setZones('')
      setNotes('')
      capteur.deconnecter()
      setMsg(`Enregistré : ${minutes} min${capteur.bilan ? `, ${capteur.bilan.moyenne} bpm moyen` : ''}.`)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sourceFcMax = fcMaxRelevee
    ? `une max relevée de ${fcMaxRelevee} bpm`
    : fcMaxEstime
      ? `une max estimée à ${fcMaxEstime} bpm (formule de Tanaka)`
      : 'aucune max connue'

  return (
    <div className="space-y-3">
      <div className="card space-y-2 border-clay/40 p-3">
        <div className="flex items-center gap-2">
          {debut !== null ? <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-clay" /> : null}
          <span className="min-w-0 flex-1 text-sm font-extrabold text-ink">⚔️ Entraînement</span>
          {debut !== null ? (
            <span className="shrink-0 font-mono text-lg font-bold text-copper">
              ⏱ {String(Math.floor((maintenant - debut) / 3600000)).padStart(2, '0')}:
              {String(Math.floor(((maintenant - debut) % 3600000) / 60000)).padStart(2, '0')}:
              {String(Math.floor(((maintenant - debut) % 60000) / 1000)).padStart(2, '0')}
            </span>
          ) : null}
        </div>

        {debut === null ? (
          <>
            <p className="text-xs leading-snug text-muted">
              Ni série ni charge : on encaisse et on frappe. Ce qui se mesure, c’est le temps et le cœur — le reste se
              déclare à la fin, sur le mannequin.
            </p>
            <button onClick={demarrer} disabled={!userId} className="btn-primary w-full py-2.5">
              ▶️ Démarrer un entraînement
            </button>
          </>
        ) : (
          <>
            <div>
              <div className="text-xs font-bold text-ink">Zones qui ont pris</div>
              <RessentiPicker value={zones} onChange={setZones} />
            </div>
            <textarea
              className="field text-xs"
              rows={2}
              placeholder="Notes (adversaires, mêlées, ce qui a fait mal…)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDebut(null)
                  capteur.deconnecter()
                }}
                className="btn-ghost flex-1 py-2 text-sm text-muted"
              >
                Abandonner
              </button>
              <button onClick={terminer} disabled={busy} className="btn-primary flex-1 py-2 text-sm">
                {busy ? '…' : `✅ Terminer (${minutes} min)`}
              </button>
            </div>
          </>
        )}

        {msg ? <p className="text-xs text-copper">{msg}</p> : null}
      </div>

      {/* Le capteur est proposé AVANT de démarrer aussi : l'appairage prend
          quelques secondes, et personne n'a envie de les passer en armure. */}
      {cardioActif ? <CardioLive capteur={capteur} fcMax={fcMax} source={sourceFcMax} /> : null}
    </div>
  )
}
