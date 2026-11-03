// Gói `diff` v7 không kèm type; chỉ khai báo phần FE dùng (so sánh theo từ trong chế độ So sánh phiên bản).
declare module 'diff' {
  export interface Change {
    value: string
    added?: boolean
    removed?: boolean
    count?: number
  }
  export function diffWordsWithSpace(oldStr: string, newStr: string): Change[]
  export function diffWords(oldStr: string, newStr: string): Change[]
}
