import semver from 'semver'
import { healthService } from './feathers'

declare global {
    interface JQuery<TElement = HTMLElement> extends Iterable<TElement> {
        toast: any
    }
}

export const checkDaemonVersion = async () => {
    const health = await healthService.find({ })

    const isCanary = !!semver.prerelease(health.version)
    const canaryVersion = health.releases?.canary?.version
    const stableVersion = health.releases?.stable?.version
    const daemonVersion = health.version
    const hasNewCanary = semver.gt(canaryVersion, daemonVersion)
    const hasNewStable = semver.gt(stableVersion, daemonVersion)

    const newVersion = isCanary && hasNewCanary ?
        canaryVersion :
        hasNewStable ? stableVersion : undefined

    if (newVersion)
        $('body')
            .toast({
                class: 'inverted yellow',
                displayTime: 0,
                message: `
                    CodeZero version ${newVersion} is now available. 
                    You are currently at ${daemonVersion}. <br />
                    CLICK to copy upgrade commands.
                `,
                onHide: () => {
                    const install = ' czctl stop && curl -L https://get.c6o.io | /bin/bash && czctl start'
                    navigator.clipboard.writeText(install)
                    return true
                }
            })
}