import { JSONPath } from 'jsonpath-plus'
declare var dayjs: typeof import('dayjs')

declare module 'dayjs' {
    interface Dayjs {
        fromNow: any
    }
}
export const jp = (row, path) =>
    JSONPath({path, json: row})

const age = (row) =>
    dayjs(jp(row, '$.metadata.creationTimestamp')).fromNow(true)

const deploymentAvailable = (row) => ({
    value: `${row.status?.availableReplicas || 0}/${row.status?.replicas || 0}`,
    states: [
        [row.status?.availableReplicas === 0 && row.status?.replicas !== 0, 'error'],
        [row.status?.availableReplicas < row.status?.replicas, 'warn'],
        [row.status?.availableReplicas === row.status?.replicas, 'ok']
    ]
})

const podStatus = (row) => ({
    value: row.metadata?.deletionTimestamp ? 'Terminating' : row.status?.phase,
    states: [
        [!!row.metadata?.deletionTimestamp, 'error'],
        [row.status?.phase === 'Running', 'ok'],
        [true, 'warn']
    ]
})

const svcExtIP = (row) => {
    if (row.spec.type !== 'LoadBalancer') return
    const result = jp(row, '$.status.loadBalancer.ingress.*.ip')
    return {
        value: result.length ? result : 'Pending',
        states: [
            [!result.length, 'warn']
        ]
    }
}

const namespaceStatus = (row) => ({
    value: row.status?.phase,
    states: [
        [row.status?.phase === 'Terminating', 'error'],
        [row.status?.phase === 'Active', 'ok'],
        [true, 'warn']
    ]
})


export const types = {
    workload: 'grey',
    network: 'blue',
    storage: 'purple',
    config: 'black',
    other: 'orange'
}

export const CZConfig = {
    all: [
        ['Age', age]
    ],
    'apps/v1': {
        Deployment: {
                type: 'workload',
                columns: [
                ['Status', '$.status.phase'],
                ['Ready', deploymentAvailable],
                ['Image', '$.spec.template.spec.containers.*.image'],
                ['Containers', '$.spec.template.spec.containers.*.name']
            ]
        }
    },
    v1: {
        Service: {
            type: 'network',
            columns: [
                ['Type', '$.spec.type'],
                ['Cluster IP', '$.spec.clusterIP'],
                ['Ext IP', svcExtIP]
            ]
        },
        Endpoints: {
            type: 'network',
        },
        Pod: {
            type: 'workload',
            columns: [
                ['Status', podStatus]
            ]
        },
        PersistentVolumeClaim: {
            type: 'storage',
            columns: [
                ['Status', '$.status.phase'],
                ['Size', '$.status.capacity.storage']
            ]
        },
        Secret: { type: 'config' },
        ConfigMap: { type: 'config' },
        Endpoint: { type: 'network' },
        Namespace: {
            type: 'network',
            columns: [
                ['Status', namespaceStatus]
            ]
        },
        Node: { type: 'other' },
        PersistentVolume: { type: 'storage' },
        ServiceAccount: { type: 'config' }
    }
}