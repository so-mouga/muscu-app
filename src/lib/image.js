/** Réduit une photo (max `taille` px de côté) en JPEG data URL, pour la stocker dans l'appli. */
export async function photoReduite(fichier, taille = 720) {
    const bitmap = await createImageBitmap(fichier);
    const k = Math.min(1, taille / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.8);
}
