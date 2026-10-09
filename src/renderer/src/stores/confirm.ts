import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  /** 主说明，例如「《高数第二章》」 */
  message?: string
  /** 次要说明，例如「文件会从磁盘删除，无法恢复」 */
  detail?: string
  confirmText?: string
  cancelText?: string
  /** 危险操作（确定键用红色），默认是 */
  danger?: boolean
}

/**
 * 全局确认框：任何一个视图里 await confirm.ask({...}) 就能拿到 true/false。
 * 由 App.vue 里常驻的 <ConfirmDialog /> 渲染。
 */
export const useConfirmStore = defineStore('confirm', () => {
  const open = ref(false)
  const opts = ref<ConfirmOptions>({ title: '' })
  let resolver: ((v: boolean) => void) | null = null

  function ask(o: ConfirmOptions): Promise<boolean> {
    // 万一上一个还没结算，先按「取消」收掉，避免 promise 一直挂着
    if (resolver) {
      const prev = resolver
      resolver = null
      prev(false)
    }
    opts.value = o
    open.value = true
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function settle(v: boolean): void {
    open.value = false
    const r = resolver
    resolver = null
    r?.(v)
  }

  return { open, opts, ask, settle }
})
