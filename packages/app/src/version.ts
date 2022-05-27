import semver from 'semver'
import { healthService } from './feathers'

declare global {
    interface JQuery<TElement = HTMLElement> extends Iterable<TElement> {
        toast: any
    }
}

let versionToastVisible = false

export const checkDaemonVersion = async () => {
    if (versionToastVisible) return // Fix: https://github.com/c6o/surf/issues/8

    const health = await healthService.find({ })

    const isCanary = !!semver.prerelease(health.version)
    const canaryVersion = health.releases?.canary?.version
    const stableVersion = health.releases?.stable?.version
    const daemonVersion = health.version
    const hasNewCanary = semver.gt(canaryVersion, daemonVersion)
    const hasNewStable = semver.gt(stableVersion, daemonVersion)
    const isTooOld = !daemonVersion || semver.lt(daemonVersion, '1.7.0')
    
    const newVersion = isCanary && hasNewCanary ?
        canaryVersion :
        hasNewStable ? stableVersion : undefined

    const onHide = () => {
        versionToastVisible = false
        const install = ' czctl stop && curl -L https://get.c6o.io | /bin/bash && czctl start'
        navigator.clipboard.writeText(install)
        return true
    }

    const onVisible = () => versionToastVisible = true

    if (isTooOld)
        $('body')
        .toast({
            onHide,
            onVisible,
            class: 'inverted red',
            displayTime: 0,
            message: `
                Surf requires CodeZero version 1.7.0 or later to run. 
                You are currently at ${daemonVersion}. <br />
                CLICK to copy upgrade commands.
            `
        })
    else if (newVersion)
        $('body')
            .toast({
                onHide,
                onVisible,
                class: 'inverted yellow',
                displayTime: 0,
                message: `
                    CodeZero version ${newVersion} is now available. 
                    You are currently at ${daemonVersion}. <br />
                    CLICK to copy upgrade commands.
                `
            })
}