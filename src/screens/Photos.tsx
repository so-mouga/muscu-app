import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeftRight, Camera, Image, Layers, Maximize2, Pencil, Plus, RefreshCw, ShieldCheck, Timer, Trash2, X } from 'lucide-react'
import Aide from '../components/Aide'
import { MESURES, nomCle } from '../data/mesures'
import { db, uid } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import { photoReduite } from '../lib/image'
import { useRetour } from '../lib/nav'
import type { Mesure, PhotoCorps, Pose } from '../types'
import { confirmer } from '../components/Dialogues'

export const POSES: { id: Pose; nom: string; consigne: string }[] = [
  { id: 'face', nom: 'Face', consigne: 'De face, bras légèrement écartés, relâché (ne contracte pas).' },
  { id: 'profil', nom: 'Profil', consigne: 'De profil, toujours le même côté, bras le long du corps.' },
  { id: 'dos', nom: 'Dos', consigne: 'De dos, bras légèrement écartés, relâché.' },
]

/** Enregistre des photos d'une date : une par pose et par jour, la nouvelle remplace l'ancienne. */
async function enregistrerPhotos(date: string, f: Partial<Record<Pose, string>>) {
  const poses = Object.entries(f) as [Pose, string][]
  if (!poses.length) return
  await db.transaction('rw', db.photos, async () => {
    await db.photos
      .where('date')
      .equals(date)
      .filter((p) => poses.some(([pose]) => pose === p.pose))
      .delete()
    await db.photos.bulkPut(poses.map(([pose, image]) => ({ id: uid(), date, pose, image })))
  })
}

/** Photos regroupées par date, la plus récente en premier. */
function parDate(photos: PhotoCorps[]) {
  const m = new Map<string, Partial<Record<Pose, PhotoCorps>>>()
  for (const p of photos) m.set(p.date, { ...m.get(p.date), [p.pose]: p })
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

/** Onglet Photos de la page Corps : séances photo et comparaison de deux dates. */
export default function Photos() {
  const photos = useLiveQuery(() => db.photos.toArray(), [], [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const [prise, setPrise] = useState(false)
  const [importer, setImporter] = useState(false)
  const [vue, setVue] = useState<PhotoCorps | null>(null)
  /** Date dont on modifie les photos (date, une pose, tout supprimer). */
  const [gerer, setGerer] = useState<string | null>(null)
  /** Les dates plus anciennes, repliées par défaut : seules les 3 dernières sont affichées en grand. */
  const [toutes, setToutes] = useState(false)
  const dates = parDate(photos)
  const recentes = dates.slice(0, 3)
  const anciennes = dates.slice(3)
  const parMois = anciennes.reduce<[string, typeof anciennes][]>((l, d) => {
    const mois = new Date(d[0] + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const der = l[l.length - 1]
    if (der && der[0] === mois) der[1].push(d)
    else l.push([mois, [d]])
    return l
  }, [])

  if (prise) return <PriseGuidee photos={photos} onFermer={() => setPrise(false)} />

  return (
    <>
      {/* Deux boutons côte à côte sur une seule ligne (44px) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setPrise(true)}
          style={{
            flex: 1.4,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--accent)',
            boxShadow: 'var(--ombre-primaire)',
            border: 'none',
            borderRadius: 'var(--rayon-2)',
            color: 'var(--accent-texte)',
            fontSize: 'var(--t-petit)',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Camera size={18} strokeWidth={2.2} />
          <span>{dates[0]?.[0] === dateISO() ? 'Compléter photos' : 'Séance photo'}</span>
        </button>

        <button
          type="button"
          onClick={() => setImporter(true)}
          style={{
            flex: 1,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            background: 'var(--voile)',
            border: '1px solid var(--voile-fort)',
            borderRadius: 'var(--rayon-2)',
            color: 'var(--texte)',
            fontSize: 'var(--t-petit)',
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Image size={17} strokeWidth={2} />
          <span>Importer</span>
        </button>
      </div>

      {/* Confidentialité : utile une fois, à la première photo. */}
      {dates.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--texte-2)', marginBottom: 14 }}>
          <ShieldCheck size={14} strokeWidth={2} style={{ color: 'var(--ok)', flexShrink: 0 }} />
          <span>Stockées uniquement sur cet appareil</span>
          <Aide
            titre="Conseils photo de progression"
            texte="3 poses : face, profil, dos. Même endroit, même lumière, même heure (idéalement le matin à jeun) : c’est ce qui rend la comparaison fiable dans le temps."
          />
        </div>
      )}

      {importer && <ImportPhotos photos={photos} onFermer={() => setImporter(false)} />}

      {dates.length >= 2 && <Comparaison dates={dates} />}

      {recentes.map(([date, poses]) => {
        const pPoids = avant(pesees, date)
        const aPoids = pPoids && Math.abs((Date.parse(date) - Date.parse(pPoids.date)) / 86400000) <= 2
        return (
          <div key={date} className="carte pile" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginBottom: 12 }}>
            <div className="ligne entre" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: 'var(--t-texte)', color: 'var(--texte)' }}>{dateCourte(date)}</strong>
                {aPoids && (
                  <span className="faible" style={{ fontSize: 'var(--t-petit)', color: 'var(--texte-2)' }}>
                    · {kg(pPoids.poids)} kg
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn discret petit"
                onClick={() => setGerer(date)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 'var(--t-legende)' }}
              >
                <Pencil size={12} strokeWidth={2} />
                <span>Modifier</span>
              </button>
            </div>
            <div className="vignettes-poses">
              {POSES.map((p) =>
                poses[p.id] ? (
                  <button key={p.id} type="button" onClick={() => setVue(poses[p.id]!)}>
                    <img src={poses[p.id]!.image} alt={`${p.nom}, ${dateCourte(date)}`} />
                    <span className="faible" style={{ fontSize: 'var(--t-legende)', marginTop: 4 }}>{p.nom}</span>
                  </button>
                ) : (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setGerer(date)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      aspectRatio: '3 / 4',
                      borderRadius: 'var(--rayon-2)',
                      border: '1px dashed var(--voile-fort)',
                      background: 'var(--surface-2)',
                      cursor: 'pointer',
                      color: 'var(--texte-2)',
                    }}
                  >
                    <Plus size={16} strokeWidth={2} style={{ opacity: 0.7 }} />
                    <span className="faible" style={{ fontSize: 'var(--t-legende)' }}>{p.nom}</span>
                  </button>
                )
              )}
            </div>
          </div>
        )
      })}

      {anciennes.length > 0 &&
        (!toutes ? (
          <button className="btn plein" style={{ borderRadius: 'var(--rayon-2)', height: 42, marginBottom: 12 }} onClick={() => setToutes(true)}>
            Voir les photos plus anciennes ({anciennes.length} date{anciennes.length > 1 ? 's' : ''})
          </button>
        ) : (
          <div className="carte pile" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginBottom: 12 }}>
            {parMois.map(([mois, l]) => (
              <div key={mois} className="pile" style={{ gap: 4 }}>
                <span className="faible" style={{ textTransform: 'capitalize', fontSize: 'var(--t-petit)', fontWeight: 600 }}>
                  {mois}
                </span>
                {l.map(([date, poses]) => (
                  <div key={date} className="ligne entre ligne-photos" style={{ padding: '6px 0' }}>
                    <button
                      type="button"
                      className="btn discret petit"
                      onClick={() => setGerer(date)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <span>{dateCourte(date)}</span>
                      <Pencil size={11} strokeWidth={2} style={{ opacity: 0.7 }} />
                    </button>
                    <span className="ligne" style={{ gap: 4 }}>
                      {POSES.map((p) =>
                        poses[p.id] ? (
                          <button key={p.id} className="mini-photo" onClick={() => setVue(poses[p.id]!)} aria-label={`${p.nom}, ${dateCourte(date)}`}>
                            <img src={poses[p.id]!.image} alt="" />
                          </button>
                        ) : (
                          <span key={p.id} className="mini-photo vide" />
                        )
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <button className="btn discret petit" style={{ alignSelf: 'center', marginTop: 4 }} onClick={() => setToutes(false)}>
              Replier
            </button>
          </div>
        ))}
      {vue && <PhotoPleine photo={vue} onFermer={() => setVue(null)} />}
      {gerer && <GererPhotos date={gerer} photos={photos} onFermer={() => setGerer(null)} />}
    </>
  )
}

/**
 * Modifier les photos d'une date : changer la date (import daté de travers), remplacer une pose par une
 * photo de la galerie, supprimer une pose ou toute la date.
 */
function GererPhotos({ date, photos, onFermer }: { date: string; photos: PhotoCorps[]; onFermer: () => void }) {
  useRetour(true, onFermer)
  const duJour = photos.filter((p) => p.date === date)
  const changerDate = async (nouvelle: string) => {
    if (!nouvelle || nouvelle === date) return
    const deja = photos.filter((p) => p.date === nouvelle && duJour.some((x) => x.pose === p.pose))
    if (deja.length && !(await confirmer(`Il y a déjà des photos le ${dateCourte(nouvelle)} pour les mêmes poses : elles seront remplacées.`, { titre: 'Changer la date ?', oui: 'Remplacer' }))) return
    await db.transaction('rw', db.photos, async () => {
      await db.photos.bulkDelete(deja.map((p) => p.id))
      await db.photos.where('date').equals(date).modify({ date: nouvelle })
    })
    onFermer()
  }
  const remplacer = async (pose: Pose, f: File | undefined) => {
    if (f) await enregistrerPhotos(date, { [pose]: await photoReduite(f, 1280) })
  }
  const supprimerPose = async (p: PhotoCorps) => {
    if (await confirmer(`Supprimer la photo « ${POSES.find((x) => x.id === p.pose)!.nom} » du ${dateCourte(date)} ?`, { oui: 'Supprimer', danger: true })) {
      await db.photos.delete(p.id)
      if (duJour.length === 1) onFermer()
    }
  }
  const toutSupprimer = async () => {
    if (await confirmer(`Supprimer les photos du ${dateCourte(date)} ?`, { oui: 'Supprimer les photos', danger: true })) {
      await db.photos.where('date').equals(date).delete()
      onFermer()
    }
  }
  return createPortal(
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>Photos du {dateCourte(date)}</h2>
        <label className="ligne entre">
          <span>Date</span>
          <input type="date" defaultValue={date} max={dateISO()} onChange={(e) => void changerDate(e.target.value)} style={{ width: 'auto' }} />
        </label>
        {POSES.map((pose) => {
          const p = duJour.find((x) => x.pose === pose.id)
          return (
            <div key={pose.id} className="ligne entre" style={{ gap: 8 }}>
              <span className="ligne" style={{ gap: 8 }}>
                {p ? <img className="mini-photo" src={p.image} alt="" /> : <span className="mini-photo vide" />}
                {pose.nom}
              </span>
              <span className="ligne" style={{ gap: 4 }}>
                <label className="btn discret petit">
                  {p ? 'Remplacer' : 'Ajouter'}
                  <input type="file" accept="image/*" hidden onChange={(e) => void remplacer(pose.id, e.target.files?.[0])} />
                </label>
                {p && (
                  <button
                    type="button"
                    className="btn discret petit danger"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => void supprimerPose(p)}
                  >
                    <Trash2 size={13} strokeWidth={2} />
                    <span>Supprimer</span>
                  </button>
                )}
              </span>
            </div>
          )
        })}
        <button
          type="button"
          className="btn discret plein danger"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => void toutSupprimer()}
        >
          <Trash2 size={15} strokeWidth={2} />
          <span>Supprimer toutes les photos de ce jour</span>
        </button>
        <button className="btn plein" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>,
    document.body
  )
}

/**
 * Import de photos déjà prises (galerie) : une date (celle du fichier par défaut, modifiable) et une
 * photo par pose. Pratique pour reprendre ses anciennes photos de progression.
 */
function ImportPhotos({ photos, onFermer }: { photos: PhotoCorps[]; onFermer: () => void }) {
  const [date, setDate] = useState(dateISO())
  const [dateTouchee, setDateTouchee] = useState(false)
  const [choisies, setChoisies] = useState<Partial<Record<Pose, string>>>({})
  const [enCours, setEnCours] = useState(false)
  const choisir = async (pose: Pose, f: File | undefined) => {
    if (!f) return
    // Date du fichier proposée tant que l'utilisateur n'a pas choisi la sienne.
    if (!dateTouchee && f.lastModified) setDate(dateISO(new Date(f.lastModified)))
    const image = await photoReduite(f, 1280)
    setChoisies((c) => ({ ...c, [pose]: image }))
  }
  const deja = POSES.filter((p) => choisies[p.id] && photos.some((x) => x.date === date && x.pose === p.id))
  const valider = async () => {
    if (deja.length && !(await confirmer(`Tu as déjà ${deja.map((p) => p.nom.toLowerCase()).join(', ')} le ${dateCourte(date)}.`, { titre: 'Remplacer ?', oui: 'Remplacer' }))) return
    setEnCours(true)
    await enregistrerPhotos(date, choisies)
    onFermer()
  }
  // Un appui à côté ou le retour gardent les photos choisies ; seul « Annuler » ne garde rien.
  const fermer = () => {
    if (!Object.keys(choisies).length) return onFermer()
    void valider()
    return 'rester' as const
  }
  useRetour(true, fermer)
  return (
    <div className="modal-fond" onClick={fermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>Importer des photos</h2>
        <label className="champ">
          <span>Date des photos</span>
          <input type="date" value={date} max={dateISO()} onChange={(e) => e.target.value && (setDate(e.target.value), setDateTouchee(true))} />
        </label>
        <div className="faible">La date du fichier est reprise par défaut : vérifie-la, une photo envoyée par message peut avoir la date d’envoi.</div>
        <div className="vignettes-poses">
          {POSES.map((p) => (
            <label key={p.id} className={choisies[p.id] ? '' : 'vide'} style={{ cursor: 'pointer' }}>
              {choisies[p.id] ? <img src={choisies[p.id]} alt={p.nom} /> : <span className="faible">+ {p.nom}</span>}
              {choisies[p.id] && <span className="faible">{p.nom}</span>}
              <input type="file" accept="image/*" hidden onChange={(e) => void choisir(p.id, e.target.files?.[0])} />
            </label>
          ))}
        </div>
        <button className="btn primaire grand" disabled={!Object.keys(choisies).length || enCours} onClick={() => void valider()}>
          {Object.keys(choisies).length ? `Enregistrer ${Object.keys(choisies).length} photo${Object.keys(choisies).length > 1 ? 's' : ''}` : 'Choisis au moins une photo'}
        </button>
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function PhotoPleine({ photo, onFermer }: { photo: PhotoCorps; onFermer: () => void }) {
  useRetour(true, onFermer)
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={onFermer}>
        <h3>
          {POSES.find((p) => p.id === photo.pose)?.nom} · {dateCourte(photo.date)}
        </h3>
        <img src={photo.image} alt="" className="photo-grande" />
        <button className="btn discret plein">Fermer</button>
      </div>
    </div>
  )
}

/** Valeur la plus proche avant (ou à) une date. */
function avant<T extends { date: string }>(liste: T[], date: string): T | undefined {
  return liste.filter((x) => x.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]
}

/** Deux dates côte à côte (ou superposées avec un curseur), et les écarts de poids et de mensurations. */
function Comparaison({ dates }: { dates: [string, Partial<Record<Pose, PhotoCorps>>][] }) {
  const liste = dates.map((d) => d[0])
  // D'office la plus ancienne face à la plus récente. Après un choix, rien ne change tout seul : une photo qui manque reste une case vide.
  // Seule exception, une date choisie puis supprimée : elle n'existe plus, on revient au choix d'office.
  const [aChoisie, setA] = useState<string | null>(null)
  const [bChoisie, setB] = useState<string | null>(null)
  const a = aChoisie && liste.includes(aChoisie) ? aChoisie : liste[liste.length - 1]
  const b = bChoisie && liste.includes(bChoisie) ? bChoisie : liste[0]
  const [pose, setPose] = useState<Pose>('face')
  const [curseur, setCurseur] = useState<number | null>(null)
  const [pleinEcran, setPleinEcran] = useState(false)
  const [voirEcarts, setVoirEcarts] = useState(false)
  const mesures = useLiveQuery(() => db.mesures.toArray(), [], [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const photo = (d: string) => dates.find((x) => x[0] === d)?.[1][pose]
  const pa = photo(a)
  const pb = photo(b)

  // Poids d'une date : seulement une pesée de ces jours-là, comme dans la liste des photos. Mensurations : la prise la plus proche avant.
  const poidsDe = (d: string) => {
    const p = avant(pesees, d)
    return p && (Date.parse(d) - Date.parse(p.date)) / 86400000 <= 2 ? p : undefined
  }
  const poidsA = poidsDe(a)
  const poidsB = poidsDe(b)
  const mA = avant<Mesure>(mesures, a)
  const mB = avant<Mesure>(mesures, b)
  const ecarts =
    mA && mB && mA.date !== mB.date
      ? MESURES.flatMap((m) => (m.cotes ? [`${m.id}_g`, `${m.id}_d`] : [m.id])).filter((c) => mA.valeurs[c] !== undefined && mB.valeurs[c] !== undefined)
      : []
  const signe = (d: number, u: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(Math.round(d * 10) / 10))} ${u}`

  const choixDate = (v: string, set: (d: string) => void) => (
    <select
      value={v}
      onChange={(e) => set(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 10px',
        background: 'var(--voile)',
        border: '1px solid var(--voile-fort)',
        borderRadius: 'var(--rayon-2)',
        color: 'var(--texte)',
        fontSize: 'var(--t-petit)',
        cursor: 'pointer',
      }}
    >
      {liste.map((d) => (
        <option key={d} value={d}>
          {dateCourte(d)}
        </option>
      ))}
    </select>
  )

  return (
    <div className="carte pile" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 'var(--t-texte)', fontWeight: 600 }}>Comparer</h3>

      {/* Sélecteurs de dates avec bouton d'inversion au centre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>{choixDate(a, setA)}</div>
        <button
          type="button"
          onClick={() => {
            setA(b)
            setB(a)
          }}
          aria-label="Inverser les dates"
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--rayon-2)',
            background: 'var(--voile)',
            border: '1px solid var(--voile-fort)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--texte)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all var(--duree-appui) ease',
          }}
        >
          <ArrowLeftRight size={15} strokeWidth={2} />
        </button>
        <div style={{ flex: 1 }}>{choixDate(b, setB)}</div>
      </div>

      {/* Barre d'outils unique : Poses à gauche, Vue (Superposer/Côte à côte + Plein écran) à droite */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 'var(--rayon-2)', border: '1px solid var(--voile)' }}>
          {POSES.map((p) => {
            const actifPose = pose === p.id
            return (
              <button
                key={p.id}
                type="button"
                style={{
                  padding: '4px 10px',
                  fontSize: 'var(--t-legende)',
                  fontWeight: actifPose ? 600 : 400,
                  color: actifPose ? 'var(--texte)' : 'var(--texte-2)',
                  background: actifPose ? 'var(--voile-fort)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--rayon-2)',
                  cursor: 'pointer',
                  transition: 'all var(--duree-appui) ease',
                }}
                onClick={() => setPose(p.id)}
              >
                {p.nom}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => setCurseur(curseur === null ? 50 : null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 'var(--rayon-2)',
              fontSize: 'var(--t-legende)',
              fontWeight: 500,
              background: 'var(--voile)',
              border: '1px solid var(--voile-fort)',
              color: 'var(--texte)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Layers size={13} strokeWidth={2} />
            <span>{curseur === null ? 'Superposer' : 'Côte à côte'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPleinEcran(true)}
            aria-label="Plein écran et zoom"
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--rayon-2)',
              background: 'var(--voile)',
              border: '1px solid var(--voile-fort)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--texte)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Maximize2 size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {curseur === null ? (
        <div className="comparaison">
          {[
            [a, pa, poidsA],
            [b, pb, poidsB],
          ].map(([d, p, w], i) => (
            <figure key={i} style={{ margin: 0, position: 'relative' }}>
              {p ? (
                <img src={(p as PhotoCorps).image} alt="" onClick={() => setPleinEcran(true)} style={{ cursor: 'zoom-in' }} />
              ) : (
                <div className="vide faible" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '3 / 4', border: '1px dashed var(--voile-fort)', borderRadius: 'var(--rayon-2)' }}>
                  Pas de photo
                </div>
              )}
              <figcaption className="faible" style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)', textAlign: 'center', marginTop: 4 }}>
                {dateCourte(d as string)}
                {w ? ` · ${kg((w as { poids: number }).poids)} kg` : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : pa && pb ? (
        <div className="superposition" style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: 'var(--rayon-2)', overflow: 'hidden' }}>
          <img src={pa.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <img src={pb.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 0 0 ${curseur}%)` }} />
          {/* Ligne blanche verticale */}
          <div className="trait-curseur" style={{ position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, background: 'var(--blanc)', left: `${curseur}%`, zIndex: 1, pointerEvents: 'none' }} />
          {/* Poignée ronde centrale bien visible */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${curseur}%`,
              transform: 'translate(-50%, -50%)',
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--barre-fond)',
              border: '2px solid var(--blanc)',
              boxShadow: '0 2px 12px var(--ombre-forte)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--blanc)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <ArrowLeftRight size={13} strokeWidth={2.5} />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={curseur}
            onChange={(e) => setCurseur(+e.target.value)}
            aria-label="Curseur de comparaison avant/après"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, margin: 0, cursor: 'ew-resize', zIndex: 3 }}
          />
          <span className="etiquette g" style={{ position: 'absolute', bottom: 8, left: 8, padding: '3px 8px', borderRadius: 999, background: 'var(--fond-masque)', color: 'var(--blanc)', fontSize: 11, pointerEvents: 'none', zIndex: 2 }}>
            {dateCourte(a)}{poidsA ? ` · ${kg(poidsA.poids)} kg` : ''}
          </span>
          <span className="etiquette d" style={{ position: 'absolute', bottom: 8, right: 8, padding: '3px 8px', borderRadius: 999, background: 'var(--fond-masque)', color: 'var(--blanc)', fontSize: 11, pointerEvents: 'none', zIndex: 2 }}>
            {dateCourte(b)}{poidsB ? ` · ${kg(poidsB.poids)} kg` : ''}
          </span>
        </div>
      ) : (
        <div className="faible" style={{ textAlign: 'center', padding: '16px 0' }}>
          Il manque la photo « {POSES.find((p) => p.id === pose)?.nom} » à l’une des deux dates.
        </div>
      )}

      {pleinEcran && <PlanchePhotos photos={dates.flatMap(([, p]) => Object.values(p))} dates={[a, b]} pose={pose} onFermer={() => setPleinEcran(false)} />}

      {((poidsA && poidsB && poidsA.date !== poidsB.date) || ecarts.length > 0) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--voile)' }}>
          <div className="faible" style={{ fontSize: 'var(--t-legende)', marginBottom: 6 }}>
            Entre ces deux dates
          </div>
          {poidsA && poidsB && poidsA.date !== poidsB.date && (
            <div className="ligne-mesure">
              <span>Poids</span>
              <strong style={{ color: 'var(--texte)' }}>{signe(poidsB.poids - poidsA.poids, 'kg')}</strong>
            </div>
          )}
          {ecarts
            .filter((c) => voirEcarts || c === 'taille')
            .map((c) => (
              <div key={c} className="ligne-mesure">
                <span>{nomCle(c)}</span>
                <strong style={{ color: 'var(--texte)' }}>{signe(mB!.valeurs[c] - mA!.valeurs[c], 'cm')}</strong>
              </div>
            ))}
          {ecarts.some((c) => c !== 'taille') && !voirEcarts && (
            <button type="button" className="groupe-repli" onClick={() => setVoirEcarts(true)}>
              <span>Les autres mesures</span>
              <span className="muted">▸</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Photos en plein écran, chacune zoomable seule : une date (vue d'un jour) ou deux côte à côte.
 * `comparerAvec` : depuis une date seule, un bouton la met à côté de cette autre date.
 */
export function PlanchePhotos({ photos, dates: depart, pose: poseDepart, comparerAvec, onFermer }: { photos: PhotoCorps[]; dates: string[]; pose?: Pose; comparerAvec?: string; onFermer: () => void }) {
  useRetour(true, onFermer)
  const [dates, setDates] = useState(depart)
  const [pose, setPose] = useState<Pose>(() => poseDepart ?? POSES.find((p) => photos.some((x) => x.date === depart[0] && x.pose === p.id))?.id ?? 'face')
  const photo = (d: string) => photos.find((p) => p.date === d && p.pose === pose)
  return createPortal(
    <div
      className="comparaison-plein"
      style={{
        padding: 'calc(6px + env(safe-area-inset-top)) 8px calc(6px + env(safe-area-inset-bottom))',
        gap: 6,
      }}
    >
      <div className="ligne entre" style={{ padding: '0 4px' }}>
        <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bord)', padding: 3, borderRadius: 'var(--rayon-2)' }}>
          {POSES.map((p) => {
            const actifPose = pose === p.id
            return (
              <button
                key={p.id}
                type="button"
                style={{
                  padding: '3px 8px',
                  fontSize: 'var(--t-legende)',
                  fontWeight: actifPose ? 600 : 400,
                  color: actifPose ? 'var(--blanc)' : 'var(--texte-2)',
                  background: actifPose ? 'var(--voile-bord)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--rayon-2)',
                  cursor: 'pointer',
                }}
                onClick={() => setPose(p.id)}
              >
                {p.nom}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onFermer}
          style={{
            background: 'var(--voile-fort)',
            border: 'none',
            borderRadius: 'var(--rayon-2)',
            padding: '4px 10px',
            color: 'var(--blanc)',
            fontSize: 'var(--t-legende)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <X size={14} strokeWidth={2} />
          <span>Fermer</span>
        </button>
      </div>
      <div className="comparaison-plein-photos" style={{ flex: 1, minHeight: 0, gap: 4, ...(dates.length === 1 ? { gridTemplateColumns: '1fr' } : {}) }}>
        {dates.map((d, i) => (
          <PhotoZoomable key={`${i}-${pose}-${d}`} image={photo(d)?.image} date={d} />
        ))}
      </div>
      {dates.length === 1 && comparerAvec && comparerAvec !== dates[0] && (
        <button
          type="button"
          className="btn plein"
          style={{ height: 38, fontSize: 'var(--t-petit)', borderRadius: 'var(--rayon-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => setDates(comparerAvec < dates[0] ? [comparerAvec, dates[0]] : [dates[0], comparerAvec])}
        >
          <ArrowLeftRight size={13} strokeWidth={2} />
          <span>Comparer avec le {dateCourte(comparerAvec)}</span>
        </button>
      )}
      <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.6, color: 'var(--texte-2)', padding: '2px 0' }}>
        Écarte deux doigts pour zoomer · glisse pour te déplacer · touche deux fois pour réinitialiser
      </div>
    </div>,
    document.body,
  )
}

/** Photo qu'on zoome à deux doigts (ou à la molette) et qu'on déplace au doigt, chacune de son côté. Deux appuis rapides : on revient. */
function PhotoZoomable({ image, date }: { image?: string; date: string }) {
  const cadre = useRef<HTMLDivElement>(null)
  const [vue, setVue] = useState({ echelle: 1, x: 0, y: 0 })
  const doigts = useRef(new Map<number, { x: number; y: number }>())
  const depart = useRef<{ vue: typeof vue; ecart: number; milieu: { x: number; y: number } } | null>(null)
  const dernierAppui = useRef(0)

  // Garde la photo dans son cadre : centrée tant qu'elle est plus petite que lui, sinon sans bande noire au bord.
  const borner = (echelle: number, x: number, y: number) => {
    const r = cadre.current!.getBoundingClientRect()
    const i = cadre.current!.querySelector('img')!
    const e = Math.min(6, Math.max(1, echelle))
    const k = Math.min(r.width / (i.naturalWidth || r.width), r.height / (i.naturalHeight || r.height))
    const axe = (t: number, cote: number, taille: number) => {
      const marge = (cote - taille) / 2
      if (taille * e <= cote) return (cote - taille * e) / 2 - marge * e
      return Math.min(-marge * e, Math.max(cote - (marge + taille) * e, t))
    }
    return { echelle: e, x: axe(x, r.width, (i.naturalWidth || r.width) * k), y: axe(y, r.height, (i.naturalHeight || r.height) * k) }
  }
  const point = (ev: { clientX: number; clientY: number }) => {
    const r = cadre.current!.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }
  // Zoome en gardant fixe le point sous les doigts.
  const zoomer = (v: typeof vue, echelle: number, avant: { x: number; y: number }, apres: { x: number; y: number }) => {
    const e = Math.min(6, Math.max(1, echelle))
    return borner(e, apres.x - ((avant.x - v.x) / v.echelle) * e, apres.y - ((avant.y - v.y) / v.echelle) * e)
  }
  const recommencer = (v: typeof vue) => {
    const p = [...doigts.current.values()]
    if (p.length >= 2) {
      depart.current = { vue: v, ecart: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), milieu: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } }
    } else if (p.length === 1) depart.current = { vue: v, ecart: 0, milieu: p[0] }
    else depart.current = null
  }

  if (!image)
    return (
      <figure className="photo-zoom">
        <div className="vide faible">Pas de photo</div>
        <figcaption className="etiquette">{dateCourte(date)}</figcaption>
      </figure>
    )

  return (
    <figure
      className="photo-zoom"
      ref={cadre}
      onPointerDown={(ev) => {
        ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
        doigts.current.set(ev.pointerId, point(ev))
        if (doigts.current.size === 1) {
          const t = Date.now()
          if (t - dernierAppui.current < 300) {
            // Deux appuis : on revient à la photo entière, ou on zoome ×2,5 là où on a touché.
            const p = point(ev)
            const v = vue.echelle > 1 ? { echelle: 1, x: 0, y: 0 } : zoomer(vue, 2.5, p, p)
            setVue(v)
            dernierAppui.current = 0
            recommencer(v)
            return
          }
          dernierAppui.current = t
        }
        recommencer(vue)
      }}
      onPointerMove={(ev) => {
        if (!doigts.current.has(ev.pointerId) || !depart.current) return
        doigts.current.set(ev.pointerId, point(ev))
        const p = [...doigts.current.values()]
        const d = depart.current
        if (p.length >= 2 && d.ecart) {
          const milieu = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
          setVue(zoomer(d.vue, (d.vue.echelle * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)) / d.ecart, d.milieu, milieu))
        } else if (p.length === 1 && d.vue.echelle > 1) {
          setVue(borner(d.vue.echelle, d.vue.x + p[0].x - d.milieu.x, d.vue.y + p[0].y - d.milieu.y))
        }
      }}
      onPointerUp={(ev) => {
        doigts.current.delete(ev.pointerId)
        recommencer(vue)
      }}
      onPointerCancel={(ev) => {
        doigts.current.delete(ev.pointerId)
        recommencer(vue)
      }}
      onWheel={(ev) => {
        const p = point(ev)
        setVue(zoomer(vue, vue.echelle * (ev.deltaY < 0 ? 1.2 : 1 / 1.2), p, p))
      }}
    >
      <img src={image} alt="" draggable={false} style={{ transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.echelle})` }} />
      <figcaption className="etiquette">
        {dateCourte(date)}
        {vue.echelle > 1.05 ? ` · ×${Math.round(vue.echelle * 10) / 10}` : ''}
      </figcaption>
    </figure>
  )
}

/** Séance photo guidée : face, profil, dos, avec la photo précédente en transparence pour se placer pareil. */
function PriseGuidee({ photos, onFermer }: { photos: PhotoCorps[]; onFermer: () => void }) {
  // Retour Android = Terminer : on garde ce qui est pris (voir `terminer`).
  useRetour(true, () => void terminer())
  const video = useRef<HTMLVideoElement>(null)
  const [flux, setFlux] = useState<MediaStream | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [avantCam, setAvantCam] = useState(false)
  const [etape, setEtape] = useState(0)
  const [fantome, setFantome] = useState(true)
  // Dernier retardateur choisi, retenu d'une séance photo à l'autre.
  const [delai, setDelaiEtat] = useState(() => {
    try {
      return Number(localStorage.getItem('retardateurPhoto') ?? 10)
    } catch {
      return 10
    }
  })
  const setDelai = (d: number) => {
    setDelaiEtat(d)
    try {
      localStorage.setItem('retardateurPhoto', String(d))
    } catch {
      /* stockage indisponible */
    }
  }
  const [decompte, setDecompte] = useState<number | null>(null)
  const [apercu, setApercu] = useState<string | null>(null)
  /** Poses enregistrées pendant cette séance photo (chacune l'est dès qu'on la garde). */
  const [faites, setFaites] = useState<Pose[]>([])
  const date = dateISO()
  const pose = POSES[etape]
  // Dernière photo de cette pose (y compris plus tôt aujourd'hui) : le repère pour se placer pareil.
  const precedente = photos.filter((p) => p.pose === pose?.id && p.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]
  const duJour = (p: Pose) => photos.some((x) => x.date === date && x.pose === p)

  useEffect(() => {
    let annule = false
    let s: MediaStream | null = null
    if (!navigator.mediaDevices?.getUserMedia) {
      setErreur('Caméra non disponible ici : utilise le bouton pour prendre la photo avec l’appareil photo du téléphone.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: avantCam ? 'user' : 'environment', height: { ideal: 1920 } }, audio: false })
      .then((m) => {
        if (annule) return m.getTracks().forEach((t) => t.stop())
        s = m
        setFlux(m)
        setErreur(null)
      })
      .catch(() => setErreur('Accès à la caméra refusé : utilise le bouton pour prendre la photo avec l’appareil photo du téléphone.'))
    return () => {
      annule = true
      s?.getTracks().forEach((t) => t.stop())
    }
  }, [avantCam])

  useEffect(() => {
    if (video.current && flux) video.current.srcObject = flux
  }, [flux, apercu])

  // Retardateur
  useEffect(() => {
    if (decompte === null) return
    if (decompte === 0) {
      setDecompte(null)
      capturer()
      return
    }
    navigator.vibrate?.(30)
    const t = setTimeout(() => setDecompte((d) => (d === null ? null : d - 1)), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decompte])

  const capturer = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * k)
    c.height = Math.round(v.videoHeight * k)
    const ctx = c.getContext('2d')!
    // Caméra avant : enregistrée comme vue à l'écran (effet miroir), pour que le fantôme corresponde.
    if (avantCam) {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0, c.width, c.height)
    navigator.vibrate?.(80)
    setApercu(c.toDataURL('image/jpeg', 0.8))
  }

  const depuisFichier = async (f: File | undefined) => {
    if (f) setApercu(await photoReduite(f, 1280))
  }

  /** Enregistre tout de suite la photo de la pose en cours (une seule photo suffit, rien ne se perd). */
  const garder = async (): Promise<boolean> => {
    if (!apercu) return false
    // Une photo de cette pose existe déjà aujourd'hui (et pas de cette séance) : on demande avant de la remplacer.
    if (duJour(pose.id) && !faites.includes(pose.id) && !(await confirmer(`Tu as déjà une photo « ${pose.nom} » aujourd’hui.`, { titre: 'Remplacer la photo ?', oui: 'Remplacer', non: 'Garder l’ancienne' })))
      return false
    await enregistrerPhotos(date, { [pose.id]: apercu })
    setFaites((f) => [...f.filter((p) => p !== pose.id), pose.id])
    return true
  }

  const suivante = async (avecPhoto: boolean) => {
    if (avecPhoto) await garder()
    setApercu(null)
    if (etape < POSES.length - 1) setEtape(etape + 1)
    else onFermer()
  }

  /** Terminer à tout moment : la photo affichée (prise, pas encore gardée) est gardée aussi. */
  const terminer = async () => {
    await garder()
    onFermer()
  }

  return (
    <div className="prise-photo">
      <div className="ligne entre prise-haut">
        <button className="btn" onClick={() => void terminer()} aria-label={faites.length || apercu ? 'Terminer en gardant les photos prises' : 'Fermer'}>
          {faites.length || apercu ? 'Terminer' : <X size={18} strokeWidth={2} />}
        </button>
        <div style={{ textAlign: 'center' }}>
          <strong>
            {etape + 1}/3 · {pose.nom}
          </strong>
          <div className="faible">{pose.consigne}</div>
        </div>
        <button className="btn discret petit" onClick={() => suivante(false)}>
          Passer
        </button>
      </div>

      <div className="viseur">
        {apercu ? (
          <img src={apercu} alt="Aperçu" />
        ) : (
          <>
            {!erreur && <video ref={video} autoPlay playsInline muted style={avantCam ? { transform: 'scaleX(-1)' } : undefined} />}
            {fantome && precedente && <img className="fantome" src={precedente.image} alt="" />}
            {decompte !== null && <div className="decompte">{decompte}</div>}
            {erreur && <div className="faible erreur-camera">{erreur}</div>}
          </>
        )}
      </div>

      {apercu ? (
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              height: 48,
              borderRadius: 'var(--rayon-2)',
              fontSize: 'var(--t-petit)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setApercu(null)}
          >
            Reprendre
          </button>
          <button
            type="button"
            className="btn primaire"
            style={{
              flex: 1.6,
              height: 48,
              borderRadius: 'var(--rayon-2)',
              fontSize: 'var(--t-petit)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
            onClick={() => suivante(true)}
          >
            {etape < POSES.length - 1 ? 'Garder et suivant →' : 'Garder et terminer ✓'}
          </button>
        </div>
      ) : (
        <div className="pile prise-bas" style={{ gap: 10 }}>
          {/* Réglages compacts sans débordement horizontal */}
          {!erreur && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                gap: 6,
                padding: '2px 0',
              }}
            >
              {/* Retardateur compact */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'var(--bord)',
                  padding: 3,
                  borderRadius: 'var(--rayon-2)',
                }}
              >
                <Timer size={13} strokeWidth={2} style={{ color: 'var(--texte-2)', marginLeft: 4, marginRight: 2 }} />
                {[0, 3, 10].map((d) => {
                  const actifDelai = delai === d
                  return (
                    <button
                      key={d}
                      type="button"
                      style={{
                        padding: '4px 8px',
                        fontSize: 'var(--t-legende)',
                        fontWeight: actifDelai ? 600 : 400,
                        color: actifDelai ? 'var(--blanc)' : 'var(--texte-2)',
                        background: actifDelai ? 'var(--accent)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--rayon-2)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => setDelai(d)}
                      aria-label={d ? `Retardateur ${d} secondes` : 'Sans retardateur'}
                    >
                      {d ? `${d}s` : 'Direct'}
                    </button>
                  )
                })}
              </div>

              {/* Repère fantôme & switch caméra */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {precedente && (
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 10px',
                      borderRadius: 'var(--rayon-2)',
                      fontSize: 'var(--t-legende)',
                      fontWeight: fantome ? 600 : 400,
                      color: fantome ? 'var(--accent)' : 'var(--texte-2)',
                      background: fantome ? 'var(--accent-voile)' : 'var(--bord)',
                      border: '1px solid ' + (fantome ? 'var(--accent)' : 'var(--voile-fort)'),
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => setFantome(!fantome)}
                    aria-label={fantome ? 'Masquer le repère' : 'Afficher le repère'}
                  >
                    <Layers size={13} strokeWidth={2} />
                    <span>Repère</span>
                  </button>
                )}

                <button
                  type="button"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--rayon-2)',
                    background: 'var(--bord)',
                    border: '1px solid var(--voile-fort)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--blanc)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  onClick={() => setAvantCam(!avantCam)}
                  aria-label="Changer de caméra"
                >
                  <RefreshCw size={15} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

          {/* Bouton de capture */}
          {erreur ? (
            <label
              className="btn primaire grand plein"
              style={{
                height: 48,
                borderRadius: 'var(--rayon-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 'var(--t-texte)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Camera size={18} strokeWidth={2} />
              <span>Prendre la photo</span>
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void depuisFichier(e.target.files?.[0])} />
            </label>
          ) : (
            <button
              type="button"
              className="btn primaire grand plein"
              style={{
                height: 48,
                borderRadius: 'var(--rayon-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 'var(--t-texte)',
                fontWeight: 600,
              }}
              onClick={() => (decompte !== null ? setDecompte(null) : delai ? setDecompte(delai) : capturer())}
            >
              <Camera size={18} strokeWidth={2} />
              <span>{decompte !== null ? `Photo dans ${decompte} s · annuler` : 'Prendre la photo'}</span>
            </button>
          )}

          {/* Choisir dans la galerie */}
          <label
            className="btn plein"
            style={{
              height: 44,
              borderRadius: 'var(--rayon-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 'var(--t-petit)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            aria-label="Choisir dans la galerie"
          >
            <Image size={16} strokeWidth={2} />
            <span>Choisir dans la galerie</span>
            <input type="file" accept="image/*" hidden onChange={(e) => void depuisFichier(e.target.files?.[0])} />
          </label>

          {precedente && fantome && (
            <div className="faible" style={{ fontSize: 'var(--t-legende)', textAlign: 'center', color: 'var(--texte-2)' }}>
              En transparence, ta photo {precedente.date === date ? 'prise plus tôt aujourd’hui' : `du ${dateCourte(precedente.date)}`} : cale-toi dessus.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
