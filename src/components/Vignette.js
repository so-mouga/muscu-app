import { jsx as _jsx } from "react/jsx-runtime";
import { MUSCLES } from '../data/exercices';
/** Photo de l'exercice, ou ses initiales sur fond neutre. */
export default function Vignette({ exo, taille = 44, onClick }) {
    const style = { width: taille, height: taille, borderRadius: Math.round(taille / 4), flex: '0 0 auto' };
    if (exo.image)
        return _jsx("img", { src: exo.image, alt: "", className: "vignette", style: { ...style, objectFit: 'cover' }, onClick: onClick });
    const initiales = (MUSCLES.find((m) => m.id === exo.muscle)?.nom ?? exo.nom).slice(0, 2);
    return (_jsx("span", { className: "vignette vide", style: { ...style, fontSize: Math.round(taille / 3) }, onClick: onClick, children: initiales }));
}
