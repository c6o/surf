import { checkDaemonVersion } from './version'

declare var io: typeof import('socket.io-client')
declare var feathers: typeof import('@feathersjs/feathers')

export const daemonURL = 'localhost:3070'
export let queryService
export let healthService

export const initFeathers = () => {
    const socket = io(`ws://${daemonURL}`, {
       transports: ['websocket'],
       path: '/api/ws/',
       upgrade: false
   })

   const client = feathers()
   //@ts-ignore
   client.configure(feathers.socketio(socket))

   socket.on('connect', async () => {
        $('#dimmer').removeClass('active')
        await checkDaemonVersion()
   })
   socket.on('disconnect', () => $('#dimmer').addClass('active'))

   queryService = client.service('api/surf/query')
   healthService = client.service('api/')
}