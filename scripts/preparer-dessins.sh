#!/bin/sh
# Prépare des dessins pour l'appli : 600 px de large, JPEG qualité 72 (environ 25 à 35 Ko), dans public/dessins/.
# Le nom du fichier doit être l'identifiant de l'exercice (data/exercices.ts), par exemple butterfly.jpg.
# Usage : sh scripts/preparer-dessins.sh maquettes/essai-dessins/butterfly.jpg maquettes/essai-dessins/presse.jpg …
# Mac seulement (sips). Ne retouche pas le fond : il doit déjà être blanc pur.
set -e
dossier="$(dirname "$0")/../public/dessins"
for source in "$@"; do
  nom="$(basename "$source" | sed 's/\.[^.]*$//').jpg"
  sips -Z 600 -s format jpeg -s formatOptions 72 "$source" --out "$dossier/$nom" > /dev/null
  echo "$nom : $(($(wc -c < "$dossier/$nom") / 1024)) Ko"
done
