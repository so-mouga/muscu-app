import { verrou } from './verrou'

describe('un seul appui sur « Enregistrer »', () => {
  it('deux appuis rapides : l’action ne part qu’une fois', async () => {
    const unSeulAppui = verrou()
    let n = 0
    const action = async () => {
      await new Promise((r) => setTimeout(r, 5))
      n++
    }
    await Promise.all([unSeulAppui(action), unSeulAppui(action)])
    await unSeulAppui(action)
    expect(n).toBe(1)
  })
  it('si l’action échoue, on peut réessayer', async () => {
    const unSeulAppui = verrou()
    let n = 0
    await expect(unSeulAppui(async () => Promise.reject(new Error('raté')))).rejects.toThrow('raté')
    await unSeulAppui(async () => void n++)
    expect(n).toBe(1)
  })
})
