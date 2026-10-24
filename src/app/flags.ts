// 功能開關（規格「功能開關」）：關閉時只隱藏入口與畫面上的提及，資料表、備份、
// 答對時建立溫故卡與成就判定照常，改回 true 就恢復原樣。
// 型別寫成 boolean 而不是字面值 false，關閉期間被隱藏的分支仍會經過型別檢查。

export const FLAGS: { review: boolean; collection: boolean } = {
  /** 溫故：卦殿學習地圖、卡牌頁加入溫故、學堂溫故入口與溫故頁、「溫」印 */
  review: false,
  /** 收藏：收藏卦牌與金句、我的頁「收藏」分頁 */
  collection: false,
}
