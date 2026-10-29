/** 網站版本：建置時的提交編號（vite.config 寫入 VITE_APP_VERSION），開發與測試時為 dev */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev'
