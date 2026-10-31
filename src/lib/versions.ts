/** « 1.10 » est plus récente que « 1.9 » : on compare nombre par nombre. */
export function plusRecente(a: string, b: string): boolean {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d > 0
  }
  return false
}

/** « android-v1.2 » → « 1.2 » (publication GitHub de l'APK), sinon null. */
export const versionDeTag = (tag: string) => /^android-v(\d+(?:\.\d+)*)$/.exec(tag)?.[1] ?? null
