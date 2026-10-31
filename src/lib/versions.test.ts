import { plusRecente, versionDeTag } from './versions'

describe('versions de l’appli Android', () => {
  it('compare nombre par nombre', () => {
    expect(plusRecente('1.2', '1.1')).toBe(true)
    expect(plusRecente('1.10', '1.9')).toBe(true)
    expect(plusRecente('1.1', '1.1')).toBe(false)
    expect(plusRecente('1.1', '1.2')).toBe(false)
    expect(plusRecente('2', '1.9')).toBe(true)
  })
  it('lit la version dans le nom de la publication', () => {
    expect(versionDeTag('android-v1.2')).toBe('1.2')
    expect(versionDeTag('v1.2')).toBeNull()
  })
})
