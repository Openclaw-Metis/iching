// 設定分頁的「加到主畫面」說明。加到主畫面後可以離線使用，iOS 的 Safari 也不會因 7 天沒開啟就清除網站資料。

export function InstallHelp() {
  return (
    <details className="accordion install-help">
      <summary>加到主畫面與離線使用</summary>
      <div className="install-body">
        <p>加到主畫面後，卦殿、今日、占卜、學堂與我的頁沒有網路也能開啟；最近看過的 30 張卡牌離線時仍是全息卡，其他卡牌改顯示平面卡圖。</p>
        <h4>iPhone、iPad（Safari）</h4>
        <ol>
          <li>用 Safari 開啟本站，按下方的分享按鈕。</li>
          <li>選「加入主畫面」，再按「新增」。</li>
        </ol>
        <p className="note">iOS 的 Safari 會清除 7 天沒開啟的網站資料；從主畫面開啟的網站不受這個限制，紀錄比較不會不見。仍建議定期匯出備份。</p>
        <h4>Android（Chrome）</h4>
        <ol>
          <li>用 Chrome 開啟本站，按右上角的選單。</li>
          <li>選「加到主畫面」或「安裝應用程式」，再確認。</li>
        </ol>
        <h4>電腦（Chrome、Edge）</h4>
        <p>網址列右側出現安裝圖示時按下，或從選單選「安裝易經卦殿」。</p>
      </div>
    </details>
  )
}
