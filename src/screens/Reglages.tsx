import { ChevronRight, Mail } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db, setReglage } from '../db'
import { CLE_RAPPEL, natif, RAPPEL_DEFAUT, rappelDisponible, type Rappel } from '../lib/natif'
import { transition, useRetour } from '../lib/nav'
import { apercu, CATEGORIES, CATEGORIES_COURANTES, clesTelephone, contenuSauvegarde, importer as importerDonnees, lire, partagerOuTelecharger, sauvegarder, type ClesTelephone, type Fichier } from '../lib/sauvegarde'
import BoutonRetour from '../components/BoutonRetour'
import { BIPS_DEFAUT } from '../components/Minuteur'
import { debloquerSon, signalSerie, tic } from '../lib/appareil'
import { confirmer, informer } from '../components/Dialogues'
import { ListeLexique } from '../components/Lexique'
import ReglesConseils from '../components/ReglesConseils'
import Interrupteur from '../components/Interrupteur'

type PageReglages = 'sauvegarde' | 'conseils' | 'lexique'

const TITRES: Record<PageReglages, string> = { sauvegarde: 'Sauvegarde', conseils: 'Comment l’appli te conseille', lexique: 'Lexique' }

const MESSAGE_FICHIER = 'Fichier créé ✓ Vérifie qu’il est bien arrivé.'

/** Partage annulé : rien à dire. Sinon, on dit que rien n'a été sauvegardé. */
const signalerEchec = (e: unknown) => {
  if ((e as Error).name !== 'AbortError') void informer((e as Error).message, 'Sauvegarde impossible')
}

/** « aujourd'hui », « hier », « il y a 12 jours ». */
function depuis(quand: number) {
  const n = Math.floor((Date.now() - quand) / 86400000)
  return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : `il y a ${n} jours`
}

export default function Reglages({ catalogue, onFermer }: { catalogue: Catalogue; onFermer?: () => void }) {
  const [page, setPage] = useState<PageReglages | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const ouvrir = (p: PageReglages | null) => transition(() => (setPage(p), setMessage(null)), p ? 'avant' : 'arriere')
  useRetour(page !== null, () => ouvrir(null))
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  const titre = page ? TITRES[page] : 'Réglages'
  const retour = page ? () => ouvrir(null) : onFermer
  return (
    <div>
      <div className="entete">
        {retour && (
          <BoutonRetour onClick={retour} />
        )}
        {page ? <h2 className="titre-souple">{titre}</h2> : <h1 className="titre-souple">{titre}</h1>}
      </div>
      {!page && <PagePrincipale onPage={ouvrir} message={message} onMessage={setMessage} />}
      {page === 'sauvegarde' && <PageSauvegarde catalogue={catalogue} message={message} onMessage={setMessage} />}
      {page === 'conseils' && <ReglesConseils />}
      {page === 'lexique' && (
        <div className="carte">
          <ListeLexique />
        </div>
      )}
    </div>
  )
}

function PagePrincipale({ onPage, message, onMessage }: { onPage: (p: PageReglages) => void; message: string | null; onMessage: (m: string) => void }) {
  const dernierExport = useLiveQuery(() => db.reglages.get('dernierExport'), [])
  const dernierPhotos = useLiveQuery(() => db.reglages.get('dernierExportPhotos'), [])
  const nbPhotos = useLiveQuery(() => db.photos.count(), [], 0)
  const contenu = useLiveQuery(
    async () => ({ programmes: await db.programmes.count(), seances: await db.seances.filter((s) => !s.enCours).count(), pesees: await db.pesees.count(), mesures: await db.mesures.count(), exercices: await db.exercices.count(), photos: nbPhotos }),
    [nbPhotos]
  )
  const bipsReglage = useLiveQuery(() => db.reglages.get('bipsRepos'), [])
  const sonValidation = useLiveQuery(() => db.reglages.get('sonValidation'), [])
  const bips = typeof bipsReglage?.valeur === 'number' ? bipsReglage.valeur : BIPS_DEFAUT

  const sauvegarderTout = async () => {
    try {
      await sauvegarder(CATEGORIES_COURANTES)
      onMessage(MESSAGE_FICHIER)
    } catch (e) {
      signalerEchec(e)
    }
  }

  return (
    <>
      <div className="carte pile">
        <h3>Tes données</h3>
        <div>Elles sont sur ce téléphone, nulle part ailleurs.</div>
        <div className="petit muted">
          {dernierExport ? `Dernière sauvegarde : ${depuis(dernierExport.valeur as number)}` : 'Aucune sauvegarde pour l’instant'}
          {nbPhotos > 0 && (
            <>
              <br />
              {dernierPhotos ? `Photos : sauvegardées ${depuis(dernierPhotos.valeur as number)}` : 'Photos : jamais sauvegardées'}
            </>
          )}
        </div>
        {contenu && <div className="petit muted">{contenuSauvegarde(contenu)}</div>}
        <button className="btn primaire plein" onClick={sauvegarderTout}>
          Sauvegarder
        </button>
        {message && <div className="petit">{message}</div>}
        <button className="ligne-reglage" onClick={() => onPage('sauvegarde')}>
          <span>Récupérer, photos, tableur</span>
          <ChevronRight size={20} className="muted" />
        </button>
      </div>

      <div className="carte pile">
        <h3>{natif ? 'Sons et rappel' : 'Sons'}</h3>
        <div>
          Bip avant la fin du repos
          <div className="chips chips-bips">
            {[0, 3, 5, 10].map((n) => (
              <button
                key={n}
                className={bips === n ? 'actif' : ''}
                onClick={() => {
                  void setReglage('bipsRepos', n)
                  debloquerSon()
                  if (n) tic()
                }}
              >
                {n ? `${n} s` : 'Aucun'}
              </button>
            ))}
          </div>
        </div>
        <Interrupteur
          on={sonValidation?.valeur !== false}
          onChange={(v) => {
            void setReglage('sonValidation', v)
            debloquerSon()
            if (v) signalSerie('mieux')
          }}
          label="Son quand je valide une série"
          aide="La vibration reste dans tous les cas."
        />
        <RappelSeance />
      </div>

      <div className="carte">
        <h3>Aide</h3>
        <button className="ligne-reglage" onClick={() => onPage('conseils')}>
          <span>Comment l’appli te conseille</span>
          <ChevronRight size={20} className="muted" />
        </button>
        <button className="ligne-reglage" onClick={() => onPage('lexique')}>
          <span>Lexique</span>
          <ChevronRight size={20} className="muted" />
        </button>
        <DonnerAvis />
      </div>
      <div className="version-appli">Cran, version du {__VERSION__}</div>
    </>
  )
}

/** Où sont les données, et le rare : récupérer une sauvegarde, sauvegarder les photos, le tableur. */
function PageSauvegarde({ catalogue, message, onMessage }: { catalogue: Catalogue; message: string | null; onMessage: (m: string) => void }) {
  const photos = useLiveQuery(
    async () => {
      let n = 0
      let taille = 0
      await db.photos.each((p) => {
        n++
        taille += p.image.length
      })
      return { n, mo: Math.max(1, Math.round(taille / 1e6)) }
    },
    [],
    { n: 0, mo: 0 }
  )
  const dernierPhotos = useLiveQuery(() => db.reglages.get('dernierExportPhotos'), [])
  const nbSeances = useLiveQuery(() => db.seances.count(), [], 0)
  const [fichier, setFichier] = useState<Fichier | null>(null)
  const jour = new Date().toISOString().slice(0, 10)

  const sauvegarderPhotos = async () => {
    try {
      await sauvegarder(['photos'])
      onMessage(MESSAGE_FICHIER)
    } catch (e) {
      signalerEchec(e)
    }
  }

  const exporterCSV = async () => {
    const seances = await db.seances.orderBy('debut').filter((s) => !s.enCours).toArray()
    const lignes = [['date', 'seance', 'exercice', 'serie', 'type', 'charge', 'reps', 'rpe', 'demi_reps', 'zone'].join(';')]
    for (const s of seances) {
      const compte: Record<string, number> = {}
      for (const x of s.series) {
        compte[x.exoId] = (compte[x.exoId] ?? 0) + 1
        lignes.push(
          [s.date, s.nom, catalogue.exo(x.exoId).nom, compte[x.exoId], x.type, String(x.charge).replace('.', ','), x.reps, String(x.rpe).replace('.', ','), x.demiReps ?? '', x.zone ?? ''].join(';')
        )
      }
    }
    try {
      await partagerOuTelecharger(`cran-series-${jour}.csv`, lignes.join('\n'), 'text/csv')
      onMessage(MESSAGE_FICHIER)
    } catch (e) {
      signalerEchec(e)
    }
  }

  const ouvrirFichier = async (f: File | undefined) => {
    if (!f) return
    try {
      setFichier(lire(await f.text()))
    } catch (e) {
      void informer((e as Error).message, 'Récupération impossible')
    }
  }

  return (
    <>
      {message && <div className="carte petit">{message}</div>}
      <div className="carte pile">
        <h3>Où sont tes données ?</h3>
        <div className="petit muted">Sur ce téléphone seulement : pas de compte, pas de serveur. Si tu le perds, elles peuvent être perdues aussi.</div>
        <div className="petit muted">Google peut en garder une copie si sa sauvegarde est activée, sans garantie, et plus du tout au-delà de 25 Mo. Ton fichier, lui, reste à toi : garde-le dans Drive ou par mail.</div>
      </div>
      {photos.n > 0 && (
        <div className="carte pile">
          <h3>Photos du corps</h3>
          <div className="petit muted">
            Plus lourdes, à part : {photos.n} photo{photos.n > 1 ? 's' : ''}, environ {photos.mo} Mo.{' '}
            {dernierPhotos ? `Sauvegardées ${depuis(dernierPhotos.valeur as number)}.` : 'Jamais sauvegardées.'}
          </div>
          <button className="btn plein" onClick={sauvegarderPhotos}>
            Sauvegarder mes photos
          </button>
        </div>
      )}
      <div className="carte">
        <label className="ligne-reglage">
          <span>Récupérer une sauvegarde</span>
          <ChevronRight size={20} className="muted" />
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void ouvrirFichier(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {nbSeances > 0 && (
          <button className="ligne-reglage" onClick={exporterCSV}>
            <span>Mes séries en tableur (CSV)</span>
            <ChevronRight size={20} className="muted" />
          </button>
        )}
      </div>
      {fichier && (
        <ChoixImport
          fichier={fichier}
          onFini={(m) => {
            setFichier(null)
            if (m) onMessage(m)
          }}
        />
      )}
    </>
  )
}

function ChoixImport({ fichier, onFini }: { fichier: Fichier; onFini: (message?: string) => void }) {
  useRetour(true, () => onFini())
  const [cles, setCles] = useState<ClesTelephone | null>(null)
  const [mode, setMode] = useState<'completer' | 'remplacer'>('completer')
  const [copie, setCopie] = useState(false)
  useEffect(() => void clesTelephone().then(setCles), [])
  if (!cles) return null
  const a = apercu(fichier, cles)
  const remplacer = a.telephoneVide || mode === 'remplacer'

  const lancer = async () => {
    if (!a.telephoneVide && remplacer && !(await confirmer(a.pertes ? `Tu perdras pour de bon : ${a.pertes}.` : 'Ce qui existe des deux côtés reprendra la version du fichier.', { titre: 'Remplacer ce qui est sur ce téléphone ?', oui: 'Remplacer mes données', danger: true }))) return
    try {
      await importerDonnees(fichier, remplacer ? 'remplacer' : 'completer')
      onFini(remplacer ? 'Sauvegarde récupérée ✓' : `Ajouté ✓ ${a.ajouts}.`)
    } catch {
      onFini('La récupération a échoué : rien n’a changé sur ce téléphone.')
    }
  }

  const sauvegarderAvant = async () => {
    try {
      await sauvegarder(CATEGORIES)
      setCopie(true)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') void informer((e as Error).message, 'Sauvegarde impossible')
    }
  }

  return (
    <div className="modal-fond" onClick={() => onFini()}>
      <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>Récupérer une sauvegarde</h2>
          {fichier.exporteLe && <div className="faible">Faite le {new Date(fichier.exporteLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
        </div>
        <div className="modal-defile pile">
          <table className="compare-import">
            <thead>
              <tr>
                <th />
                <th>Fichier</th>
                <th>Téléphone</th>
              </tr>
            </thead>
            <tbody>
              {a.lignes.map((l) => (
                <tr key={l.nom}>
                  <td>{l.nom}</td>
                  <td>{l.fichier}</td>
                  <td>{l.telephone}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!a.telephoneVide && (
            <div className="choix-prochaine une-colonne">
              <button className={mode === 'completer' ? 'actif' : ''} onClick={() => setMode('completer')}>
                <strong>Compléter</strong>
                <span className="faible">{a.ajouts ? `Ajoute ${a.ajouts}.` : 'Tout est déjà sur ce téléphone : rien à ajouter.'} Le reste ne change pas.</span>
              </button>
              <button className={mode === 'remplacer' ? 'actif' : ''} onClick={() => setMode('remplacer')}>
                <strong>Remplacer</strong>
                <span className="faible">
                  Efface ce qui est ici et remet le fichier.{a.pertes ? ` Perdu : ${a.pertes}.` : ''}{a.avecPhotos ? '' : ' Tes photos ne changent pas.'}
                </span>
              </button>
            </div>
          )}
          {!a.telephoneVide && remplacer && (copie ? (
            <div className="petit">Copie de ce téléphone créée ✓</div>
          ) : (
            <button className="btn plein" onClick={sauvegarderAvant}>
              Sauvegarder d’abord ce téléphone
            </button>
          ))}
        </div>
        <button className={'btn grand' + (remplacer && !a.telephoneVide ? ' danger' : ' primaire')} disabled={!remplacer && !a.ajouts} onClick={lancer}>
          {a.telephoneVide ? 'Récupérer' : remplacer ? 'Remplacer' : 'Compléter'}
        </button>
        <button className="btn discret plein" onClick={() => onFini()}>
          Annuler
        </button>
      </div>
    </div>
  )
}

/**
 * Rappel de séance (appli Android 1.6 et plus) : les jours prévus par le planning, à l'heure choisie,
 * sauf si une séance a déjà été démarrée ce jour-là. Coupé par défaut. Android reçoit le réglage depuis App.
 */
function RappelSeance() {
  const [dispo, setDispo] = useState<boolean | null>(null)
  useEffect(() => void rappelDisponible().then(setDispo), [])
  const r = useLiveQuery(() => db.reglages.get(CLE_RAPPEL), [], null)
  if (!natif || dispo === null || r === null) return null
  const rappel = (r?.valeur as Rappel | undefined) ?? RAPPEL_DEFAUT
  const maj = (c: Partial<Rappel>) => setReglage(CLE_RAPPEL, { ...rappel, ...c })
  return (
    <>
      {dispo ? (
        <>
          <Interrupteur on={rappel.actif} onChange={(actif) => maj({ actif })} label="Rappel les jours de séance" aide="Une notification, sauf si ta séance est commencée." />
          {rappel.actif && (
            <label className="ligne entre">
              <span>Heure</span>
              <input type="time" value={rappel.heure} onChange={(e) => e.target.value && maj({ heure: e.target.value })} style={{ width: 'auto' }} />
            </label>
          )}
        </>
      ) : (
        <div className="faible">Pour le rappel de séance, il faut la dernière version de l’appli : installe-la depuis le bandeau de l’accueil, tes données sont gardées.</div>
      )}
    </>
  )
}

/** Adresse des retours : celle de l'auteur de l'appli (publique, choisie par lui). */
const CONTACT_AVIS = 'kevin.mougammadaly+muscu@gmail.com'

/** Retours des utilisateurs : un mail pré-rempli, avec de quoi reproduire un souci (version, appareil). */
function DonnerAvis() {
  const corps = `Ce qui m’a plu :\n\n\nCe qui m’a bloqué ou pas clair :\n\n\nCe qui m’a manqué :\n\n\n---\nVersion du ${__VERSION__} · ${natif ? 'appli Android' : 'navigateur'} · ${navigator.userAgent}`
  const lien = `mailto:${CONTACT_AVIS}?subject=${encodeURIComponent('Cran : mon avis')}&body=${encodeURIComponent(corps)}`
  return (
    <a className="ligne-reglage" href={lien}>
      <span>
        Donner mon avis
        <span className="faible">Un bug, une idée, même en deux mots</span>
      </span>
      <Mail size={20} className="muted" />
    </a>
  )
}
