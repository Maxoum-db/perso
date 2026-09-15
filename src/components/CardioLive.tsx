import { bluetoothDisponible, type Capteur } from '../lib/capteurCardio'
import { fmtSecondes, totalZones, zone, zoneDe, ZONES } from '../lib/cardio'

// La fréquence cardiaque pendant la séance.
//
// En gros, et en couleur : entre deux séries on la regarde à un mètre, le
// téléphone posé sur un banc. Un chiffre de la taille du reste de l'écran ne
// se lit pas dans ces conditions — d'où le 5xl et la couleur de zone.
//
// La barre des zones sous le chiffre répond à la seule question qui compte en
// musculation : combien de temps ai-je vraiment poussé, par opposition au temps
// passé dans la salle. Une séance d'une heure dont dix minutes au-dessus de
// 80 % n'est pas la même qu'une séance d'une heure dont trente.

export function CardioLive({ capteur, fcMax, source }: { capteur: Capteur; fcMax: number | null; source: string }) {
  if (capteur.etat === 'absent') {
    return (
      <section className="card p-3">
        <div className="text-xs font-bold text-ink">❤️ Fréquence cardiaque</div>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          {bluetoothDisponible()
            ? 'Capteur indisponible sur cet appareil.'
            : 'Ce navigateur ne sait pas parler aux capteurs Bluetooth. Sur Android, ouvre Couanac dans Chrome ; sur iPhone, aucun navigateur ne le permet.'}
        </p>
      </section>
    )
  }

  const z = capteur.bpm !== null && fcMax ? zone(zoneDe(capteur.bpm, fcMax)) : null
  const total = totalZones(capteur.acc.zones)

  return (
    <section className="card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-ink">❤️ Fréquence cardiaque</div>
        {capteur.etat === 'connecté' ? (
          <button onClick={capteur.deconnecter} className="text-[11px] text-muted hover:text-clay">
            {capteur.nom} · couper
          </button>
        ) : (
          <button
            onClick={capteur.connecter}
            disabled={capteur.etat === 'recherche' || capteur.etat === 'connexion'}
            className="btn-ghost px-2 py-1 text-[11px] text-copper disabled:opacity-50"
          >
            {capteur.etat === 'recherche'
              ? 'Recherche…'
              : capteur.etat === 'connexion'
                ? 'Connexion…'
                : capteur.etat === 'perdu'
                  ? '🔄 Reconnecter'
                  : '🔗 Brancher le capteur'}
          </button>
        )}
      </div>

      {capteur.erreur ? <p className="mt-1 text-[11px] text-clay">{capteur.erreur}</p> : null}

      {capteur.etat === 'perdu' ? (
        <p className="mt-1 text-[11px] leading-snug text-clay">
          Liaison perdue — brassard éteint, trop loin, ou écran verrouillé trop longtemps. Les minutes déjà mesurées
          sont gardées.
        </p>
      ) : null}

      {capteur.bpm !== null ? (
        <>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span
              className="text-5xl font-extrabold leading-none tabular-nums"
              style={{ color: z?.couleur ?? '#e8e0d4' }}
            >
              {capteur.bpm}
            </span>
            <span className="text-xs font-semibold text-muted">bpm</span>
          </div>
          <div className="mt-1 text-center text-[11px] font-semibold" style={{ color: z?.couleur ?? undefined }}>
            {z ? z.label : 'Zone inconnue — renseigne ton année de naissance'}
            {z && fcMax ? ` · ${Math.round((capteur.bpm / fcMax) * 100)} % de ${fcMax}` : ''}
          </div>
          {/* Le brassard décroché est dit, et seulement quand le capteur SAIT
              le dire : les modèles qui l'ignorent renvoient `null`, et afficher
              « décroché » pour eux serait une alerte permanente et fausse. */}
          {capteur.contact === false ? (
            <p className="mt-1 text-center text-[11px] text-clay">⚠️ Brassard décroché — resserre-le.</p>
          ) : null}
        </>
      ) : capteur.etat === 'connecté' ? (
        <p className="mt-2 text-center text-[11px] text-muted">En attente du premier battement…</p>
      ) : (
        <p className="mt-1 text-[11px] leading-snug text-muted">
          Allume le brassard et touche « Brancher ». Rien ne part sur internet : la mesure passe du capteur au
          téléphone, et reste dans ta séance.
        </p>
      )}

      {total > 0 && fcMax ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[10px] text-muted">
            <span className="font-bold uppercase tracking-wide">Temps par zone</span>
            <span>
              {capteur.bilan ? `moy. ${capteur.bilan.moyenne} · max ${capteur.bilan.max}` : ''}
            </span>
          </div>
          {/* Une barre par zone, à l'échelle du temps total. Les zones jamais
              atteintes ne s'affichent pas : cinq lignes à zéro diraient
              seulement qu'on a cinq zones. */}
          <div className="mt-1 space-y-1">
            {ZONES.filter((zn) => capteur.acc.zones[zn.id] > 0)
              .slice()
              .reverse()
              .map((zn) => {
                const s = capteur.acc.zones[zn.id]
                return (
                  <div key={zn.id} className="flex items-center gap-1.5">
                    <span className="w-16 shrink-0 text-[10px] font-semibold" style={{ color: zn.couleur }}>
                      {zn.label}
                    </span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round((s / total) * 100)}%`, background: zn.couleur }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted">
                      {fmtSecondes(s)}
                    </span>
                  </div>
                )
              })}
          </div>
          <p className="mt-1 text-[10px] italic text-muted/70">Zones calculées sur {source}.</p>
        </div>
      ) : null}
    </section>
  )
}
