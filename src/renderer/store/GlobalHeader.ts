import router from '@/router'
import { LocalAccount } from '~/src/types/localAccount'
import { Module, MutationTree, ActionTree } from 'vuex'
import { RootState } from '@/store'
import { StreamingError } from '~src/errors/streamingError'
import { MyWindow } from '~/src/types/global'

const win = window as MyWindow

export type GlobalHeaderState = {
  accounts: Array<LocalAccount>
  changing: boolean
  hide: boolean
}

const state = (): GlobalHeaderState => ({
  accounts: [],
  changing: false,
  hide: false
})

export const MUTATION_TYPES = {
  UPDATE_ACCOUNTS: 'updateAccounts',
  UPDATE_CHANGING: 'updateChanging',
  CHANGE_HIDE: 'changeHide'
}

const mutations: MutationTree<GlobalHeaderState> = {
  [MUTATION_TYPES.UPDATE_ACCOUNTS]: (state: GlobalHeaderState, accounts: Array<LocalAccount>) => {
    state.accounts = accounts
  },
  [MUTATION_TYPES.UPDATE_CHANGING]: (state: GlobalHeaderState, value: boolean) => {
    state.changing = value
  },
  [MUTATION_TYPES.CHANGE_HIDE]: (state: GlobalHeaderState, value: boolean) => {
    state.hide = value
  }
}

const actions: ActionTree<GlobalHeaderState, RootState> = {
  initLoad: async ({ dispatch }): Promise<Array<LocalAccount>> => {
    // Ignore error
    try {
      await dispatch('removeShortcutEvents')
      await dispatch('loadHide')
      dispatch('watchShortcutEvents')
    } catch (err) {
      console.error(err)
    }
    const accounts = await dispatch('listAccounts')
    // Block to root path when user use browser-back, like mouse button.
    // Because any contents are not rendered when browser back to / from home.
    router.beforeEach((to, from, next) => {
      if (!(to.fullPath === '/' && from.name)) {
        return next()
      }
    })
    return accounts
  },
  startStreamings: async ({ dispatch }) => {
    dispatch('bindNotification')
    dispatch('startUserStreamings')
  },
  listAccounts: ({ dispatch, commit }): Promise<Array<LocalAccount>> => {
    return new Promise((resolve, reject) => {
      win.ipcRenderer.send('list-accounts', 'list')
      win.ipcRenderer.once('error-list-accounts', (_, err: Error) => {
        win.ipcRenderer.removeAllListeners('response-list-accounts')
        reject(err)
      })
      win.ipcRenderer.once('response-list-accounts', (_, accounts: Array<LocalAccount>) => {
        win.ipcRenderer.removeAllListeners('error-list-accounts')
        commit(MUTATION_TYPES.UPDATE_ACCOUNTS, accounts)
        dispatch('refreshAccounts')
        resolve(accounts)
      })
    })
  },
  // Fetch account informations and save current state when GlobalHeader is displayed
  refreshAccounts: ({ commit }): Promise<Array<LocalAccount>> => {
    return new Promise((resolve, reject) => {
      win.ipcRenderer.send('refresh-accounts')
      win.ipcRenderer.once('error-refresh-accounts', (_, err: Error) => {
        win.ipcRenderer.removeAllListeners('response-refresh-accounts')
        reject(err)
      })
      win.ipcRenderer.once('response-refresh-accounts', (_, accounts: Array<LocalAccount>) => {
        win.ipcRenderer.removeAllListeners('error-refresh-accounts')
        commit(MUTATION_TYPES.UPDATE_ACCOUNTS, accounts)
        resolve(accounts)
      })
    })
  },
  watchShortcutEvents: ({ state, commit, rootState, rootGetters }) => {
    win.ipcRenderer.on('change-account', (_, account: LocalAccount) => {
      if (state.changing) {
        return null
      }
      if ((rootState.route.params.id as string) === account._id!) {
        return null
      }
      // When the modal window is active, don't change account
      if (rootGetters['TimelineSpace/Modals/modalOpened']) {
        return null
      }
      // changing finish after loading
      commit(MUTATION_TYPES.UPDATE_CHANGING, true)
      router.push(`/${account._id}/home`)
      return true
    })
  },
  removeShortcutEvents: async () => {
    win.ipcRenderer.removeAllListeners('change-account')
    return true
  },
  loadHide: ({ commit }): Promise<boolean> => {
    return new Promise(resolve => {
      win.ipcRenderer.send('get-global-header')
      win.ipcRenderer.once('response-get-global-header', (_, hide: boolean) => {
        commit(MUTATION_TYPES.CHANGE_HIDE, hide)
        resolve(hide)
      })
    })
  },
  switchHide: ({ dispatch }, hide: boolean): Promise<boolean> => {
    return new Promise(resolve => {
      win.ipcRenderer.send('change-global-header', hide)
      win.ipcRenderer.once('response-change-global-header', () => {
        dispatch('loadHide')
        resolve(true)
      })
    })
  },
  startUserStreamings: ({ state }): Promise<{}> => {
    // @ts-ignore
    return new Promise((resolve, reject) => {
      win.ipcRenderer.once('error-start-all-user-streamings', (_, err: StreamingError) => {
        reject(err)
      })
      win.ipcRenderer.send('start-all-user-streamings', state.accounts)
    })
  },
  stopUserStreamings: () => {
    win.ipcRenderer.send('stop-all-user-streamings')
  },
  bindNotification: () => {
    win.ipcRenderer.removeAllListeners('open-notification-tab')
    win.ipcRenderer.on('open-notification-tab', (_, id: string) => {
      router.push(`/${id}/home`)
      // We have to wait until change el-menu-item
      setTimeout(() => router.push(`/${id}/notifications`), 500)
    })
  }
}

const GlobalHeader: Module<GlobalHeaderState, RootState> = {
  namespaced: true,
  state: state,
  mutations: mutations,
  actions: actions
}

export default GlobalHeader
