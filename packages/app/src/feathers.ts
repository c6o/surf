declare var io: typeof import('socket.io-client')
declare var feathers: typeof import('@feathersjs/feathers')

export const daemonURL = 'localhost:3070'
export let queryService
export let healthService
export let socket

export const initFeathers = () => {
    socket = io(`ws://${daemonURL}`, {
       transports: ['websocket'],
       path: '/api/ws/',
       upgrade: false
   })

   const client = feathers()
   //@ts-ignore
   client.configure(feathers.socketio(socket))
   queryService = client.service('api/surf/query')
   healthService = client.service('api/')
}