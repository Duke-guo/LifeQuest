import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { dataApi } from '../services/data'
import type { UpdateCheckResult } from '../../../shared/types'

/** 更新检查状态：主进程启动时后台查一次，这里缓存并共享给头像红点 / 设置页 */
export const useUpdateStore = defineStore('update', () => {
  const state = ref<UpdateCheckResult | null>(null)
  const checking = ref(false)

  const hasUpdate = computed(() => state.value?.ok === true && state.value.hasUpdate)

  /** 拉取主进程已查到的结果 + 订阅后台完成通知（App 挂载时调用一次） */
  async function init(): Promise<void> {
    const cur = await dataApi.updateState()
    if (cur) state.value = cur
    dataApi.onUpdateChanged((r) => {
      state.value = r
    })
  }

  /** 手动触发一次检查（主进程会缓存并广播，这里同步更新本地状态） */
  async function check(): Promise<UpdateCheckResult> {
    checking.value = true
    try {
      const r = await dataApi.checkUpdate()
      state.value = r
      return r
    } finally {
      checking.value = false
    }
  }

  return { state, checking, hasUpdate, init, check }
})
