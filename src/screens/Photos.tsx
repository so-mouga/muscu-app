import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { MESURES, nomCle } from '../data/mesures'
import { db, uid } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import { photoReduite } from '../lib/image'
import { useRetour } from '../lib/nav'
import type { Mesure, PhotoCorps, Pose } from '../types'

export const POSES: { id: Pose; nom: string; consigne: string }[] = [
  { id: 'face', nom: 'Face', consigne: 'De face, bras légèrement écartés, relâché (ne contracte pas).' },
  { id: 'profil', nom: 'Profil', consigne: 'De profil, toujours le même côté, bras le long du corps.' },
  { id: 'dos', nom: 'Dos', consigne: 'De dos, bras légèrement écartés, relâché.' },
]

/** Photos regroupées par date, la plus récente en premier. */
function parDate(photos: PhotoCorps[]) {
  const m = new Map<string, Partial<Record<Pose, PhotoCorps>>>()
  for (const p of photos) m.set(p.date, { ...m.get(p.date), [p.pose]: p })
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

/** Onglet Photos de la page Corps : séances photo et comparaison de deux dates. */
export default function Photos() {
  const photos = useLiveQuery(() => db.photos.toArray(), [], [])
  const [prise, setPrise] = useState(false)
  const [vue, setVue] = useState<PhotoCorps | null>(null)
  const dates = parDate(photos)

  if (prise) return <PriseGuidee photos={photos} onFermer={() => setPrise(false)} />

  return (
    <>
      <button className="btn primaire grand" style={{ marginBottom: 12 }} onClick={() => setPrise(true)}>
        {dates[0]?.[0] === dateISO() ? '📸 Refaire / compléter les photos du jour' : '📸 Nouvelle séance photo'}
      </button>
      <div className="faible" style={{ marginBottom: 12 }}>
        3 poses : face, profil, dos. Même endroit, même lumière, même heure : c’est ce qui rend la comparaison fiable. Les photos restent sur ce téléphone.
      </div>

      {dates.length >= 2 && <Comparaison dates={dates} />}

      {dates.map(([date, poses]) => (
        <div key={date} className="carte pile">
          <div className="ligne entre">
            <strong>{dateCourte(date)}</strong>
            <button
              className="btn discret petit danger"
              onClick={() => confirm(`Supprimer les photos du ${dateCourte(date)} ?`) && db.photos.where('date').equals(date).delete()}
            >
              Supprimer
            </button>
          </div>
          <div className="vignettes-poses">
            {POSES.map((p) =>
              poses[p.id] ? (
                <button key={p.id} onClick={() => setVue(poses[p.id]!)}>
                  <img src={poses[p.id]!.image} alt={`${p.nom}, ${dateCourte(date)}`} />
                  <span className="faible">{p.nom}</span>
                </button>
              ) : (
                <div key={p.id} className="vide">
                  <span className="faible">{p.nom}</span>
                </div>
              )
            )}
          </div>
        </div>
      ))}
      {vue && <PhotoPleine photo={vue} onFermer={() => setVue(null)} />}
    </>
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
  const [a, setA] = useState(liste[liste.length - 1])
  const [b, setB] = useState(liste[0])
  const [pose, setPose] = useState<Pose>('face')
  const [curseur, setCurseur] = useState<number | null>(null)
  const mesures = useLiveQuery(() => db.mesures.toArray(), [], [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const photo = (d: string) => dates.find((x) => x[0] === d)?.[1][pose]
  const pa = photo(a)
  const pb = photo(b)

  // Écarts entre les deux dates : poids (pesée la plus proche avant) et mensurations (prise la plus proche avant).
  const poidsA = avant(pesees, a)
  const poidsB = avant(pesees, b)
  const mA = avant<Mesure>(mesures, a)
  const mB = avant<Mesure>(mesures, b)
  const ecarts =
    mA && mB && mA.date !== mB.date
      ? MESURES.flatMap((m) => (m.cotes ? [`${m.id}_g`, `${m.id}_d`] : [m.id])).filter((c) => mA.valeurs[c] !== undefined && mB.valeurs[c] !== undefined)
      : []
  const signe = (d: number, u: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(Math.round(d * 10) / 10))} ${u}`

  const choixDate = (v: string, set: (d: string) => void) => (
    <select value={v} onChange={(e) => set(e.target.value)}>
      {liste.map((d) => (
        <option key={d} value={d}>
          {dateCourte(d)}
        </option>
      ))}
    </select>
  )

  return (
    <div className="carte pile">
      <h3>Comparer</h3>
      <div className="ligne" style={{ gap: 8 }}>
        {choixDate(a, setA)}
        <span className="faible">→</span>
        {choixDate(b, setB)}
      </div>
      <div className="ligne entre wrap" style={{ gap: 8 }}>
        <div className="chips">
          {POSES.map((p) => (
            <button key={p.id} className={pose === p.id ? 'actif' : ''} onClick={() => setPose(p.id)}>
              {p.nom}
            </button>
          ))}
        </div>
        <button className="btn discret petit" onClick={() => setCurseur(curseur === null ? 50 : null)}>
          {curseur === null ? '⇆ Superposer' : '▥ Côte à côte'}
        </button>
      </div>

      {curseur === null ? (
        <div className="comparaison">
          {[
            [a, pa],
            [b, pb],
          ].map(([d, p], i) => (
            <figure key={i}>
              {p ? <img src={(p as PhotoCorps).image} alt="" /> : <div className="vide faible">Pas de photo</div>}
              <figcaption className="faible">{dateCourte(d as string)}</figcaption>
            </figure>
          ))}
        </div>
      ) : pa && pb ? (
        <div className="superposition">
          <img src={pa.image} alt="" />
          <img src={pb.image} alt="" style={{ clipPath: `inset(0 0 0 ${curseur}%)` }} />
          <div className="trait-curseur" style={{ left: `${curseur}%` }} />
          <input type="range" min={0} max={100} value={curseur} onChange={(e) => setCurseur(+e.target.value)} aria-label="Curseur de comparaison" />
          <span className="etiquette g">{dateCourte(a)}</span>
          <span className="etiquette d">{dateCourte(b)}</span>
        </div>
      ) : (
        <div className="faible">Il manque la photo « {POSES.find((p) => p.id === pose)?.nom} » à l’une des deux dates.</div>
      )}

      {(poidsA && poidsB && poidsA.date !== poidsB.date) || ecarts.length ? (
        <div>
          <div className="faible" style={{ marginBottom: 4 }}>
            Entre ces deux dates
          </div>
          {poidsA && poidsB && poidsA.date !== poidsB.date && (
            <div className="ligne-mesure">
              <span>Poids</span>
              <strong>{signe(poidsB.poids - poidsA.poids, 'kg')}</strong>
            </div>
          )}
          {ecarts.map((c) => (
            <div key={c} className="ligne-mesure">
              <span>{nomCle(c)}</span>
              <strong>{signe(mB!.valeurs[c] - mA!.valeurs[c], 'cm')}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Séance photo guidée : face, profil, dos, avec la photo précédente en transparence pour se placer pareil. */
function PriseGuidee({ photos, onFermer }: { photos: PhotoCorps[]; onFermer: () => void }) {
  useRetour(true, onFermer)
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
  const [faites, setFaites] = useState<Partial<Record<Pose, string>>>({})
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

  const suivante = (garder: boolean) => {
    // Une photo de cette pose existe déjà aujourd'hui : on demande avant de la remplacer.
    if (garder && duJour(pose.id) && !confirm(`Remplacer ta photo « ${pose.nom} » d’aujourd’hui par celle-ci ?`)) garder = false
    const f = garder && apercu ? { ...faites, [pose.id]: apercu } : faites
    setFaites(f)
    setApercu(null)
    if (etape < POSES.length - 1) setEtape(etape + 1)
    else void terminer(f)
  }

  const terminer = async (f: Partial<Record<Pose, string>>) => {
    const poses = Object.entries(f) as [Pose, string][]
    if (poses.length)
      await db.transaction('rw', db.photos, async () => {
        // Une photo par pose et par jour : la nouvelle remplace celle du jour.
        await db.photos
          .where('date')
          .equals(date)
          .filter((p) => poses.some(([pose]) => pose === p.pose))
          .delete()
        await db.photos.bulkPut(poses.map(([pose, image]) => ({ id: uid(), date, pose, image })))
      })
    onFermer()
  }

  return (
    <div className="prise-photo">
      <div className="ligne entre prise-haut">
        <button className="btn" onClick={onFermer}>
          ✕
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
        <div className="ligne prise-bas">
          <button className="btn grand" style={{ flex: 1 }} onClick={() => setApercu(null)}>
            Reprendre
          </button>
          <button className="btn primaire grand" style={{ flex: 2 }} onClick={() => suivante(true)}>
            {etape < POSES.length - 1 ? 'GARDER · SUIVANTE' : 'GARDER · TERMINER'}
          </button>
        </div>
      ) : (
        <div className="pile prise-bas">
          {!erreur && (
            <div className="ligne entre wrap" style={{ gap: 6 }}>
              <div className="chips">
                {[0, 3, 10].map((d) => (
                  <button key={d} className={delai === d ? 'actif' : ''} onClick={() => setDelai(d)}>
                    {d ? `⏱ ${d} s` : 'Direct'}
                  </button>
                ))}
              </div>
              <span className="ligne" style={{ gap: 6 }}>
                {precedente && (
                  <button className={'btn petit' + (fantome ? ' actif-btn' : '')} onClick={() => setFantome(!fantome)}>
                    👻 {fantome ? 'Repère' : 'Sans repère'}
                  </button>
                )}
                <button className="btn petit" onClick={() => setAvantCam(!avantCam)} aria-label="Changer de caméra">
                  🔄
                </button>
              </span>
            </div>
          )}
          {erreur ? (
            <label className="btn primaire grand">
              📸 PRENDRE LA PHOTO
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void depuisFichier(e.target.files?.[0])} />
            </label>
          ) : (
            <button className="btn primaire grand" onClick={() => (decompte !== null ? setDecompte(null) : delai ? setDecompte(delai) : capturer())}>
              {decompte !== null ? `Photo dans ${decompte} s · appuie pour annuler` : '📸 PRENDRE LA PHOTO'}
            </button>
          )}
          {precedente && fantome && (
            <div className="faible">
              En transparence, ta photo {precedente.date === date ? 'prise plus tôt aujourd’hui' : `du ${dateCourte(precedente.date)}`} : cale-toi dessus.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
