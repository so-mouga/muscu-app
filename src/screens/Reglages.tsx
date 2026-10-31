import { natif } from '../lib/natif'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db, setReglage } from '../db'
import { useRetour } from '../lib/nav'
import { CATEGORIES, CATEGORIES_COURANTES, compter, importer as importerDonnees, lire, partagerOuTelecharger, sauvegarder, type Categorie, type Fichier } from '../lib/sauvegarde'
import { PAS_BOUTONS, PAS_BOUTONS_DEFAUT } from '../lib/pasBoutons'
import { BIPS_DEFAUT } from '../components/Minuteur'
import { debloquerSon, signalSerie, tic } from '../lib/appareil'
import { confirmer } from '../components/Dialogues'
import { ListeLexique } from '../components/Lexique'
import Interrupteur from '../components/Interrupteur'
import ChampNombre from '../components/ChampNombre'
import { ACTIVITES, CLE_PROFIL, type Profil } from '../lib/nutrition'

export default function Reglages({ catalogue }: { catalogue: Catalogue }) {
  const dernierExport = useLiveQuery(() => db.reglages.get('dernierExport'), [])
  const pasBoutons = useLiveQuery(() => db.reglages.get('pasBoutons'), [])
  const pasActuel = typeof pasBoutons?.valeur === 'number' ? pasBoutons.valeur : PAS_BOUTONS_DEFAUT
  const bipsReglage = useLiveQuery(() => db.reglages.get('bipsRepos'), [])
  const sonValidation = useLiveQuery(() => db.reglages.get('sonValidation'), [])
  const bips = typeof bipsReglage?.valeur === 'number' ? bipsReglage.valeur : BIPS_DEFAUT
  const [persistant, setPersistant] = useState<boolean | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const jour = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistant, () => setPersistant(null))
  }, [])

  const [choixExport, setChoixExport] = useState(false)
  const [fichier, setFichier] = useState<Fichier | null>(null)

  const exporter = async (cats: Categorie[]) => {
    try {
      await sauvegarder(cats)
      setChoixExport(false)
      setMessage('Export prêt ✓')
    } catch {
      /* partage annulé */
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
      await partagerOuTelecharger(`muscu-series-${jour}.csv`, lignes.join('\n'), 'text/csv')
    } catch {
      /* partage annulé */
    }
  }

  const ouvrirFichier = async (f: File | undefined) => {
    if (!f) return
    try {
      setFichier(lire(await f.text()))
    } catch (e) {
      setMessage('Import impossible : ' + (e as Error).message)
    }
  }

  return (
    <div>
      <div className="entete">
        <h1>Réglages</h1>
      </div>

      <DonnerAvis />

      <MonProfil />

      <div className="carte pile">
        <h3>Saisie de la charge</h3>
        <div className="faible">Pas des boutons −/+ en séance et dans l’objectif de la prochaine fois.</div>
        <div className="chips">
          {PAS_BOUTONS.map((p) => (
            <button key={p} className={pasActuel === p ? 'actif' : ''} onClick={() => setReglage('pasBoutons', p)}>
              {p === 0 ? 'Pas de l’exercice' : `${String(p).replace('.', ',')} kg`}
            </button>
          ))}
        </div>
        <div className="faible">
          « Pas de l’exercice » : celui réglé dans sa fiche (Exercices → l’exercice → Modifier), pour ne proposer que des charges qui existent sur la
          machine. Élastiques : toujours 1 niveau.
        </div>
      </div>

      <div className="carte pile">
        <h3>Fin du repos</h3>
        <div className="faible">Un bip à chaque seconde sur les dernières secondes du repos, pour te remettre en place avant la sonnerie.</div>
        <div className="chips">
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
              {n ? `${n} dernières s` : 'Aucun bip'}
            </button>
          ))}
        </div>
      </div>

      <div className="carte pile">
        <Interrupteur
          on={sonValidation?.valeur !== false}
          onChange={(v) => {
            void setReglage('sonValidation', v)
            debloquerSon()
            if (v) signalSerie('mieux')
          }}
          label="Son à la validation d’une série"
          aide="Un petit clic ; deux notes quand tu fais mieux que la dernière fois ; trois quand tu passes à l’exercice suivant. La vibration reste dans tous les cas."
        />
      </div>

      <div className="carte pile">
        <h3>Sauvegarde</h3>
        <div className="faible">
          Tes données sont stockées uniquement sur ce téléphone. Exporte-les chaque semaine (Drive, mail…) pour ne rien perdre en cas de changement de téléphone.
        </div>
        <div className="petit muted">
          Dernier export :{' '}
          {dernierExport ? new Date(dernierExport.valeur as number).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : 'jamais'}
        </div>
        <button className="btn primaire plein" onClick={() => setChoixExport(true)}>
          Exporter…
        </button>
        <label className="btn plein">
          Importer…
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
        <button className="btn discret plein" onClick={exporterCSV}>
          Exporter les séries en tableur (CSV)
        </button>
        {message && <div className="petit">{message}</div>}
      </div>
      {choixExport && <ChoixExport onExporter={exporter} onFermer={() => setChoixExport(false)} />}
      {fichier && (
        <ChoixImport
          fichier={fichier}
          onFini={(m) => {
            setFichier(null)
            if (m) setMessage(m)
          }}
        />
      )}

      <div className="carte pile">
        <h3>Stockage</h3>
        <div className="petit muted">
          {persistant === true && '✓ Stockage persistant accordé : le navigateur ne l’effacera pas automatiquement.'}
          {persistant === false && 'Stockage non persistant. Installe l’appli sur l’écran d’accueil (menu ⋮ → Installer) pour le renforcer.'}
          {persistant === null && 'État du stockage inconnu.'}
        </div>
      </div>

      <Lexique />

      <div className="carte pile">
        <h3>À propos</h3>
        <div className="faible">
          L’objectif de chaque séance est de refaire la précédente : c’est toi qui décides quand monter (fin de séance, ou « Voir » → ✎). Le pas de charge d’un exercice se règle dans sa fiche (Exercices → Modifier).
        </div>
        <div className="faible">Version du {__VERSION__}</div>
      </div>
    </div>
  )
}

/** Case à cocher d'une catégorie de données. */
function Case({ coche, onClick, nom, detail }: { coche: boolean; onClick: () => void; nom: string; detail: string }) {
  return (
    <button className={'liste-btn' + (coche ? ' coche' : '')} onClick={onClick}>
      <span>
        <strong>{nom}</strong>
        <div className="faible">{detail}</div>
      </span>
      <span className="case">{coche ? '✓' : ''}</span>
    </button>
  )
}

const basculer = <T,>(x: T[], v: T) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v])

function ChoixExport({ onExporter, onFermer }: { onExporter: (cats: Categorie[]) => void; onFermer: () => void }) {
  useRetour(true, onFermer)
  const nombres = useLiveQuery(compter, [])
  const [cats, setCats] = useState<Categorie[]>(CATEGORIES_COURANTES)
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>Exporter</h2>
          <div className="faible">Choisis ce que tu sauvegardes. Pour une sauvegarde complète, garde tout coché (et les photos de temps en temps).</div>
        </div>
        <div>
          {CATEGORIES.map((c) => (
            <Case
              key={c.id}
              coche={cats.includes(c.id)}
              onClick={() => setCats((x) => basculer(x, c.id))}
              nom={`${c.nom}${nombres ? ` (${nombres[c.id]})` : ''}`}
              detail={c.detail}
            />
          ))}
        </div>
        <button className="btn primaire grand" disabled={!cats.length} onClick={() => onExporter(cats)}>
          EXPORTER
        </button>
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function ChoixImport({ fichier, onFini }: { fichier: Fichier; onFini: (message?: string) => void }) {
  useRetour(true, () => onFini())
  const [cats, setCats] = useState<Categorie[]>(fichier.presentes.map((c) => c.id))
  const [remplacer, setRemplacer] = useState(false)
  const lancer = async () => {
    if (remplacer && !(await confirmer('Les données cochées seront effacées sur ce téléphone, puis remplacées par celles du fichier.', { titre: 'Remplacer tes données ?', oui: 'Remplacer mes données', danger: true }))) return
    try {
      await importerDonnees(fichier, cats, remplacer)
      onFini('Import terminé ✓')
    } catch (e) {
      onFini('Import impossible : ' + (e as Error).message)
    }
  }
  return (
    <div className="modal-fond" onClick={() => onFini()}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>Importer</h2>
          {fichier.exporteLe && (
            <div className="faible">Export du {new Date(fichier.exporteLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          )}
        </div>
        <div>
          {fichier.presentes.map((p) => {
            const c = CATEGORIES.find((x) => x.id === p.id)!
            return <Case key={p.id} coche={cats.includes(p.id)} onClick={() => setCats((x) => basculer(x, p.id))} nom={`${c.nom} (${p.n})`} detail={c.detail} />
          })}
        </div>
        <div className="segments" role="tablist">
          <button className={!remplacer ? 'actif' : ''} onClick={() => setRemplacer(false)}>
            Ajouter
          </button>
          <button className={remplacer ? 'actif' : ''} onClick={() => setRemplacer(true)}>
            Remplacer
          </button>
        </div>
        <div className="faible">
          {remplacer
            ? 'Restauration : les données cochées sont effacées sur ce téléphone, puis remplacées par celles du fichier.'
            : 'Les données du fichier s’ajoutent aux tiennes (un élément identique est mis à jour). Rien n’est effacé.'}
        </div>
        <button className={'btn grand' + (remplacer ? ' danger' : ' primaire')} disabled={!cats.length} onClick={lancer}>
          {remplacer ? 'REMPLACER' : 'AJOUTER'}
        </button>
        <button className="btn discret plein" onClick={() => onFini()}>
          Annuler
        </button>
      </div>
    </div>
  )
}

/** Les termes de l'appli, repliés par défaut. */
function Lexique() {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="carte pile">
      <button type="button" className="groupe-repli" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <span>
          <strong>Lexique</strong> <span className="faible">PDC, RPE, 1RM, déload…</span>
        </span>
        <span className="muted">{ouvert ? '▾' : '▸'}</span>
      </button>
      {ouvert && <ListeLexique />}
    </div>
  )
}

/** Profil saisi une fois : sert à calculer l'objectif calories (le poids vient des pesées). */
function MonProfil() {
  const reglage = useLiveQuery(() => db.reglages.get(CLE_PROFIL), [], null)
  if (reglage === null) return null
  const p = (reglage?.valeur as Profil | undefined) ?? {}
  // Relu en base à chaque fois : deux saisies rapprochées ne s'écrasent pas.
  const maj = (c: Partial<Profil>) => void db.transaction('rw', db.reglages, async () => db.reglages.put({ cle: CLE_PROFIL, valeur: { ...((await db.reglages.get(CLE_PROFIL))?.valeur as Profil | undefined), ...c } }))
  return (
    <div className="carte pile">
      <h3>Mon profil</h3>
      <div className="faible">Pour calculer ton objectif calories selon ta phase (Progression → Objectifs). Ton poids vient de tes pesées. Tout reste sur ce téléphone.</div>
      <div className="ligne entre">
        <span>Taille</span>
        <span className="ligne" style={{ gap: 6 }}>
          <ChampNombre valeur={p.taille} placeholder="—" onChange={(v) => maj({ taille: v && Math.round(v) })} />
          <span className="faible">cm</span>
        </span>
      </div>
      <div className="ligne entre">
        <span>Année de naissance</span>
        <ChampNombre valeur={p.naissance} placeholder="—" onChange={(v) => maj({ naissance: v && v > 1900 && v < 2020 ? Math.round(v) : undefined })} />
      </div>
      <div className="ligne entre">
        <span>Sexe</span>
        <div className="chips">
          {(
            [
              ['h', 'Homme'],
              ['f', 'Femme'],
            ] as const
          ).map(([id, nom]) => (
            <button key={id} className={p.sexe === id ? 'actif' : ''} onClick={() => maj({ sexe: id })}>
              {nom}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 6 }}>Activité hors salle</div>
        <div className="chips">
          {ACTIVITES.map((a) => (
            <button key={a.id} className={p.activite === a.id ? 'actif' : ''} onClick={() => maj({ activite: a.id })}>
              {a.nom}
            </button>
          ))}
        </div>
        {p.activite && <div className="faible" style={{ marginTop: 4 }}>{ACTIVITES.find((a) => a.id === p.activite)!.detail}</div>}
      </div>
    </div>
  )
}

/** Adresse des retours : celle de l'auteur de l'appli (publique, choisie par lui). */
const CONTACT_AVIS = 'kevin.mougammadaly@gmail.com'

/** Retours des utilisateurs : un mail pré-rempli, avec de quoi reproduire un souci (version, appareil). */
function DonnerAvis() {
  const corps = `Ce qui m’a plu :\n\n\nCe qui m’a bloqué ou pas clair :\n\n\nCe qui m’a manqué :\n\n\n---\nVersion du ${__VERSION__} · ${natif ? 'appli Android' : 'navigateur'} · ${navigator.userAgent}`
  const lien = `mailto:${CONTACT_AVIS}?subject=${encodeURIComponent('Muscu : mon avis')}&body=${encodeURIComponent(corps)}`
  return (
    <div className="carte pile">
      <h3>💬 Donner mon avis</h3>
      <div className="faible">Un bug, une idée, quelque chose de pas clair ? Ça ouvre un mail déjà préparé : écris ce que tu veux, même en deux mots.</div>
      <a className="btn plein" href={lien}>
        Écrire mon avis
      </a>
    </div>
  )
}
