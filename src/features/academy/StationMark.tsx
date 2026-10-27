import { HexagramGlyph } from '../../components/HexagramGlyph.tsx'
import type { Station } from '../../data/stations.ts'
import { trigrams } from '../../data/trigrams.ts'

/** 課程與考核開始前，右側標出這一站的八卦 */
export function StationMark({ station, note }: { station: Station; note: string }) {
  const t = trigrams.find(x => x.name === station.trigram)!
  return (
    <aside className="station-mark" aria-hidden="true">
      <HexagramGlyph className="glyph grow" lines={t.lines} />
      <b>{t.name}</b>
      <span>{t.image}・{station.theme}</span>
      <small>{note}</small>
    </aside>
  )
}
