import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BRANCHES, STEMS, castTime, ganzhiIndex, ganzhiName } from '../../lib/ganzhi.ts'
import { NajiaPanel } from './NajiaPanel.tsx'

afterEach(cleanup)

// 2026-11-12 中午（本地時間）：離交節很遠，月建不受時區影響
const castAt = new Date(2026, 10, 12, 12, 0).toISOString()
const rows = () => within(screen.getByRole('list')).getAllByRole('listitem').map(li => li.textContent ?? '')

describe('納甲六爻盤', () => {
  it('乾之夬：由上爻排到初爻，標出世應、變出的爻與起卦時間的月建日辰', () => {
    // 乾卦上爻老陽
    render(<NajiaPanel lines={[7, 7, 7, 7, 7, 9]} castAt={castAt} />)
    const cast = castTime(new Date(castAt))
    expect((screen.getByLabelText('月建') as HTMLSelectElement).value).toBe(String(cast.month))
    expect(screen.getByLabelText<HTMLSelectElement>('日辰').selectedOptions[0].textContent).toBe(`${ganzhiName(cast.day)}日`)
    const list = rows()
    expect(list).toHaveLength(6)
    expect(list[0]).toContain('父母 壬戌土')
    expect(list[0]).toContain('世')
    expect(list[0]).toContain('化父母 丁未土')
    expect(list[3]).toContain('應')
    expect(list[5]).toContain('子孫 甲子水')
    expect(screen.getByText(/乾為天屬乾宮首卦/)).toBeTruthy()
  })

  it('改成辰月戊子日：上爻月破、化出的未土旬空、朱雀在上爻（《增刪卜易》乾之夬）', () => {
    render(<NajiaPanel lines={[7, 7, 7, 7, 7, 9]} castAt={castAt} />)
    fireEvent.change(screen.getByLabelText('月建'), { target: { value: String(BRANCHES.indexOf('辰')) } })
    fireEvent.change(screen.getByLabelText('日辰'), { target: { value: String(ganzhiIndex(STEMS.indexOf('戊'), BRANCHES.indexOf('子'))) } })
    const top = rows()[0]
    expect(top).toContain('朱雀')
    expect(top).toMatch(/壬戌土世月破/)
    expect(top).toMatch(/丁未土旬空/)
    expect(screen.getByText('旬空：午未')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '回到起卦時間' }))
    expect(screen.queryByRole('button', { name: '回到起卦時間' })).toBeNull()
  })

  it('天風姤：缺妻財，寅木伏在二爻', () => {
    render(<NajiaPanel lines={[8, 7, 7, 7, 7, 7]} castAt={castAt} />)
    expect(screen.getByText(/本卦六爻沒有妻財，從本宮首卦乾為天取伏神/)).toBeTruthy()
    expect(rows()[4]).toContain('伏妻財 甲寅木')
  })
})
