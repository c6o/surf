
export const initDownload = async () => {
    // The following fails because of CORS and needs to get addressed
    // It may be because of sentry or local self signed certificate
    /*const response = await fetch('https://releases.codezero.io/release.json', { 
        mode: 'cors',
    })
    const releases = await response.json()
    const version = releases.stable.version
    */
    const version = '1.7.1'

    $('#mac-x64-download').on('click', () => {
        const url = `https://releases.codezero.io/${version}/CodeZero-darwin-x64.pkg`
        console.log('OPENING', url)
        window.open(url, '_self')
    })

    $('#mac-arm64-download').on('click', () => {
        const url = `https://releases.codezero.io/${version}/CodeZero-darwin-arm64.pkg`
        console.log('OPENING', url)
        window.open(url, '_self')
    })
}