import { createLocalVue } from '@vue/test-utils'
import Vuex from 'vuex'
import { ipcMain, ipcRenderer } from '~/spec/mock/electron'
import Notification, { NotificationState } from '@/store/Preferences/Notification'
import { MyWindow } from '~/src/types/global'
;((window as any) as MyWindow).ipcRenderer = ipcRenderer

const state = (): NotificationState => {
  return {
    notification: {
      notify: {
        reply: true,
        reblog: true,
        favourite: true,
        follow: true,
        follow_request: true,
        reaction: true,
        status: true,
        poll_vote: true
      }
    }
  }
}

const initStore = () => {
  return {
    namespaced: true,
    state: state(),
    actions: Notification.actions,
    mutations: Notification.mutations
  }
}

const App = {
  namespaced: true,
  actions: {
    loadPreferences: jest.fn()
  }
}

describe('Preferences/Notification', () => {
  let store
  let localVue

  beforeEach(() => {
    localVue = createLocalVue()
    localVue.use(Vuex)
    store = new Vuex.Store({
      modules: {
        Notification: initStore(),
        App: App
      }
    })
  })

  describe('loadNotification', () => {
    beforeEach(() => {
      ipcMain.handle('get-preferences', () => {
        return {
          notification: {
            notify: {
              reply: false,
              reblog: false,
              favourite: false,
              follow: false,
              follow_request: false,
              reaction: false,
              status: false,
              poll_vote: false
            }
          }
        }
      })
      afterEach(() => {
        ipcMain.removeHandler('get-preferences')
      })
      it('should be updated', async () => {
        await store.dispatch('Notification/loadNotification')
        expect(store.state.Notification.notification).toEqual({
          notify: {
            reply: false,
            reblog: false,
            favourite: false,
            follow: false,
            follow_request: false,
            reaction: false,
            status: false,
            poll_vote: false
          }
        })
      })
    })
  })

  describe('updateNotify', () => {
    beforeEach(() => {
      ipcMain.handle('update-preferences', (_, conf: object) => {
        return conf
      })
    })
    afterEach(() => {
      ipcMain.removeHandler('update-preferences')
    })
    it('should be updated', async () => {
      await store.dispatch('Notification/updateNotify', {
        reply: false,
        reblog: false
      })
      expect(store.state.Notification.notification).toEqual({
        notify: {
          reply: false,
          reblog: false,
          favourite: true,
          follow: true,
          follow_request: true,
          reaction: true,
          status: true,
          poll_vote: true
        }
      })
      expect(App.actions.loadPreferences).toBeCalled()
    })
  })
})
