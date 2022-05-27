import { CZConfig, jp, types } from './config'
import { initFeathers, queryService, daemonURL, socket } from './feathers'
import { renderHelpPage, initHelp, placeHelpModal } from './help'
import { checkDaemonVersion } from './version'
import { gitSHA } from './sha'

declare var hotkeys: typeof import('hotkeys-js').default
declare var Terminal: typeof import('xterm').Terminal
declare var FitAddon: typeof import('xterm-addon-fit')
declare var dayjs: typeof import('dayjs')

declare global {
    interface Window {
        dayjs_plugin_relativeTime: any
        gotoPage: any
        limitChange: any
        groupChange: any
    }
    interface JQuery<TElement = HTMLElement> extends Iterable<TElement> {
        sidebar: any
        dimmer: any
        popup: any
    }
}

dayjs.extend(window.dayjs_plugin_relativeTime)

let result
let lastQueryId
let previousResult
let page = 1
let limit = 50
let groupBy = 'none'
let selectedItem


const grouping = [
    { key: 'none', value: 'none', display: 'None' },
    { key: 'kind', value: 'kind', display: 'Kind' },
    { key: 'namespace', value: 'metadata.namespace', display: 'Namespace' },
    { key: 'type', value: 'type', display: 'Type' }
]

function* getPages() {
    if (!result) return
    const extra = (result.total % limit) > 0 ? 1 : 0
    const lastPage = Math.floor(result.total / limit) + extra
    if (lastPage === 1) return
    yield 1
    if (page - 1 > 1)
        yield page - 1
    if (page > 1 && page < lastPage)
        yield page
    if (page + 1 < lastPage)
        yield page + 1
    yield lastPage
}

const isActivePage = (p) => p === page ? 'active' : ''

// So we can use with onlick events
window.gotoPage = async (p) => await doSearch($('#search-input').val(), p, false)
window.limitChange = async (l) => {
    limit = l
    window.localStorage.setItem('kq-limit', limit.toString())
    await doSearch($('#search-input').val(), undefined, false)
}

window.groupChange = async (g) => {
    groupBy = g
    window.localStorage.setItem('kq-group', groupBy)
    await doSearch($('#search-input').val(), undefined, false)
}

const renderPagination = () => {
    const pages = Array.from(getPages())
    return pages.length ? `
        <div class="ui pagination menu">
            ${pages.map(p =>
                `<a value="${p}" type="pageItem" onclick="gotoPage(${p})" class="item ${isActivePage(p)}">${p}</a>`
            ).join('')}
        </div>
    ` : ''
}

const renderResultRange = () => result?.skip + result?.limit > result?.total ?
    `${result?.skip + 1} - ${result?.total} of ${result?.total}` :
    `${result?.skip + 1} - ${result?.skip + result?.limit} of ${result?.total}`

const renderLimitDropdown = () => `
    <div class="ui compact menu">
        <div role="listbox" class="ui item simple dropdown">
            <div class="divider text">Limit ${limit}</div>
            <i class="dropdown icon"></i>
                <div class="menu transition">
                    ${[10, 20, 50, 100, 200].map(l => `
                        <div style="pointer-events:all" onclick="limitChange(${l})" role="option" class="item ${l === limit ? "selected": ""} "><span class="text">${l}</span></div>
                    `).join('')}
                </div>
        </div>
    </div>
`
const renderGroupDropdown = () => `
    <div class="ui compact menu">
        <div role="listbox" class="ui item simple dropdown">
            <div class="divider text">Group by ${groupBy}</div>
            <i class="dropdown icon"></i>
            <div class="menu transition">
                ${grouping.map(groupItem => `
                    <div style="pointer-events:all" onclick="groupChange('${groupItem.key}')" role="option" class="item ${groupBy === groupItem.key ? "selected": ""} "><span class="text">${groupItem.display}</span></div>
                `).join('')}
            </div>
        </div>
    </div>
`

const renderAvatar = (user) => `<img class="ui avatar image"  data-title="${user.name}" data-content="" src="https://www.gravatar.com/avatar/${CryptoJS.MD5(user.email).toString()}?s=28"/>`
const distinct = (value, index, self) => self.findIndex(i => i.email === value.email) === index
const renderSessionUsers = (resource) => jp(resource, '$.sessions.*.spec.session-users.*').filter(distinct).map(renderAvatar).join('&nbsp;&nbsp;')

const renderResult = () => `

    ${renderPagination()}
    ${renderLimitDropdown()}
    ${renderGroupDropdown()}

    <table class="k8s ui celled small compact striped selectable sortable table">
        <thead>
            <tr>
                <th>Kind</th>
                <th>Namespace</th>
                <th>Name</th>
                <th>Sessions</th>
                <th>
                    <div class="ui grid">
                        <div class="right floated right aligned column">
                            <a class="item">
                                ${renderResultRange()}
                            </a>
                        </div>
                    </div>
                </th>
                <!-- th>Actions</th -->
            </tr>
        </thead>
        ${renderResultBodies()}
    </table>
`

const groupResultsByPath = (path) => result?.data.reduce((rv, row) => {
    const val = jp(row, path)[0] || 'not-set'
    const res = rv[val] = rv[val] || []
    res.push(row)
    return rv
}, {})

const groupResultsByType = () => result?.data.reduce((rv, row) => {
    const val = toType(row)
    const res = rv[val] = rv[val] || []
    res.push(row)
    return rv
}, {})


const renderResultBodies = () => {
    if (groupBy === 'none') return renderResultBody(result?.data)
    let grouped
    if (groupBy === 'type')
        grouped = groupResultsByType()
    else {
        const path = groupBy === 'kind' ?
            'kind' :
            'metadata.namespace'
        grouped = groupResultsByPath(path)
    }

    let content = ''
    for(const key in grouped) {
        const data = grouped[key]
        content += renderResultBody(data)
    }
    return content
}

const toType = (row) => CZConfig[row.apiVersion]?.[row.kind]?.type || 'other'

const renderKindLabel = (row) => {
    const type = toType(row)
    return `<a class="ui ${types[type]} label">${row.kind}</a>`
}

const renderResultBody = (data, header?) => `
    <tbody>
        ${header ? `<tr><th colspan="100%">${header}</th></tr>` : ''}
        ${data?.map((row, index) => (`
                <tr id=${row.metadata.uid} class="${rowChanged(row) ? 'changed' : ''}">
                    <td class="collapsing">${renderKindLabel(row)}</td>
                    <td class="collapsing">${row.metadata?.namespace || ''}</td>
                    <td class="collapsing">${row.metadata?.name}</td>
                    <td class="collapsing">${renderSessionUsers(row)}</td>
                    <td>${renderKindInfo(row, index)}</td>
                    <!-- td>${renderActionButtons(row, index)}</td -->
                </tr>
        `)).join('')}
    </tbody>
`

const rowChanged = (row) => {
    const oldRow = previousResult?.data?.find(r => r.metadata.uid === row.metadata.uid)
    if (!oldRow) return true
    // Thankfully, k8s has resource versioning so we don't have to diff
    return row.metadata.resourceVersion !== oldRow.metadata.resourceVersion
}

const renderKindInfo = (row, index) => {
    const all = CZConfig.all
    const kind = CZConfig[row.apiVersion]?.[row.kind]?.columns || []
    const columns = [...all, ...kind]
    if (!columns) return ``

    let content = '<div style="word-wrap: break-word;flex: inherit">'
    let comma = false
    for(const field of columns) {
        const [title, path, ...params] = field
        if (comma)
            content += '&nbsp;'
        else
            comma = true
        try {
            const data = typeof path === 'function' ?
                path.call(null, row, ...params) :
                jp(row, path)


            if (data) {
                if (typeof data === 'string' || (Array.isArray(data) && data.length === 1))
                    content += `${title} &nbsp; <div class="ui horizontal label">${data}</div>`
                else if (data.value) { // we have an object
                    const { value, states } = data
                    const [ignore, state] = states.find(item => item[0] === true) || [true, 'ok'] // finds the first true state
                    const color = state === 'error' ? 'red' : state === 'warn' ? 'yellow' : ''
                    content += `${title} &nbsp; <div class="ui horizontal ${color} label">${value}</div>`
                }
            }

        }
        catch(ex) {
            content += `<span>${title}: ERROR ${ex.message}</span>`
        }
    }
    content += '</div>'
    return content
}

const renderActionButtons = (row, index) => (`
    <button class="mini basic ui button" type="button" onclick="actionClicked(${index})">Teleport</button>
`)

const cleanupValue = (stringVal, numberVal) => {
    if (stringVal) {
        return /\s|-/g.test(stringVal) ? // check for whitespace
            stringVal :
            stringVal.replaceAll('"', '') // strip quotes
    }
    else if (numberVal)
        return parseInt(numberVal)
}

const rowToItem = (tr) => result?.data.find(item => item.metadata.uid === $(tr).attr('id'))

const rowClicked = (e) => {
    // if (!$(e.target).hasClass('selectable')) return
    $('.k8s tbody tr').removeClass('active')

    const tr = $(e.target).closest('tr')
    //const index = tr.index()
    selectedItem = rowToItem(tr)

    const jsonTree = document.querySelector<any>('#json')
    jsonTree.data = selectedItem
    //jsonTree.expand(/metadata/)
    jsonTree.expandAll()

    // $('.sidebar').sidebar('toggle')
    tr.addClass('active')
}

const refresh = () => {
    selectedItem = null
    $('#data-dump').html(result?.total ?
        renderResult() :
        renderHelpPage('No results found')
    )
    $('.k8s tbody').on('click', 'tr', rowClicked)

    const jsonTree = document.querySelector<any>('#json')
    jsonTree.data = result?.data.find(item => item.metadata?.uid === jsonTree.data?.metadata?.uid)
}

const onCreated = (resource) => {
    console.log('Created', resource)
    result?.data.push(resource)
    refresh()
}

const onUpdated = (resource) => {
    console.log('Updated', resource)
    const index = result?.data.findIndex(i => i.metadata.uid === resource.metadata.uid)
    if (index > -1)
        result.data[index] = resource
    else
        result.data.push(resource)
    refresh()
}

const onRemoved = (resource) => {
    console.log('Removed', resource)
    const index = result?.data.findIndex(i => i.metadata.uid === resource.metadata.uid)
    if (index > -1) {
        result.data = result.data.splice(index, 1)
        refresh()
    }
}

const cleanupQuery = async () => {
    if (lastQueryId) {
        await queryService.remove(lastQueryId)
        lastQueryId = null
    }
}

const doSearch = async (s, p = 1, setInput = true, pushState = true) => {
    if (!s) return

    console.log('sending', s)
    const skip = limit * (p - 1)

    // Delete the previous hot query
    await cleanupQuery()

    const result = await queryService.create({ s, skip, limit })
    lastQueryId = result.id

    if (setInput) {
        $('#search-input').val(s)
        $('#search-input').select()
    }
    page = p

    if (pushState) {
        const url = new URL(window.document.URL)
        url.searchParams.delete('s')
        url.searchParams.delete('p')
        url.searchParams.set('s', s)
        url.searchParams.set('p', p.toString())
        window.history.pushState({ s, p }, '', url.toString())
    }

    window.gtag?.('event', 'search')
}

const searchInputKeydown = async (e) => {
    const target = e.target
    const value = target.value

    if (e.key === ':' && value.length === 0)
        e.preventDefault() // ignore : accidentally pressed
    else if (e.keyCode === 13) {
        e.preventDefault()
        await doSearch(value)
    }
    else if (e.keyCode === 57) { // ( clicked - enclose selection in brackets
        const start = target.selectionStart
        const end = target.selectionEnd
        if (start !== undefined && start !== end) {
            e.preventDefault()
            const sel = value.substring(start, end)
            const replace = `(${sel}) && `
            target.value = value.substring(0, start) + replace + value.substring(end, value.length)
        }
    }
    else if (e.keyCode === 48) { // ) clicked - enclose past
        const braceIndex = value.indexOf('(')
        if (braceIndex === -1 || braceIndex > target.selectionStart) {
            e.preventDefault() // no opening bracket
            const start = 0
            const end = target.selectionEnd
            const sel = value.substring(start, end)
            const replace = `(${sel}) && `
            target.value = value.substring(0, start) + replace + value.substring(end, value.length)
        }
    }

}

const initWatches = () => {
    // queryService.on('created', onCreated)
    // queryService.on('updated', onUpdated)
    // queryService.on('removed', onRemoved)
    queryService.on('sync', (payload) => {
        if (lastQueryId && payload.id !== lastQueryId)
            return // This is for some other connection
        console.log('Synced', payload)
        previousResult = result
        result = payload
        refresh()

    })
}

const onSearchKey = (e?) => {
    e?.preventDefault()
    const input = $('#search-input')
    input.focus()
    input.select()
}

const showLogs = (pod) => {
    if (!pod || pod.kind !== 'Pod')
        return
    const ns = pod.metadata.namespace
    const n = pod.metadata.name
    const containers = jp(pod, '$.spec.containers.*.name')

    let reader
    const pipeLogData = async () => {
        const chunk = await reader.read()
        if (chunk.done) return
        term.write(chunk.value)
        await pipeLogData()
    }

    const term = new Terminal({
        fontFamily: 'courier-new, courier, monospace',
        fontSize: 24,
        theme: { background: "#00000011" },
        allowTransparency: true,
        disableStdin: true,
        convertEol: true
    })

    term.onKey(key => {
        // Hide on Esc
        if (key.key === '\u001b') // ESC
            $('#terminal-dimmer').dimmer('hide')
    })

    $('#terminal-dimmer').dimmer({
        onHide: async () => {
            await reader?.cancel()
            term.dispose()
        },
        onShow: async () => {
            const fitAddon = new FitAddon.FitAddon()
            term.loadAddon(fitAddon)
            term.open($('#terminal')[0])
            fitAddon.fit()
            term.focus()

            if (containers.length > 1)
                $('#terminal-header').html(`
                    <div class="ui compact menu">
                        <div role="listbox" class="ui item simple dropdown">
                            <i class="dropdown icon"></i>
                            <div class="menu transition">
                                ${containers.map(c => `
                                    <div style="pointer-events:all" role="option" class="item"} "><span class="text">${c}</span></div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `)

            const c = containers.length > 1 ? `&c=${containers[0]}` : ''
            const result = await fetch(`http://${daemonURL}/api/surf/logs?ns=${ns}&n=${n}${c}`)
            reader = result.body.getReader()
            await pipeLogData()
        }
    }).dimmer('show')

    window.gtag?.('event', 'logs')
}

const initHotKeys = () => {
    $('search-input').on('focus', () => hotkeys.unbind('shift+;'))
    $('search-input').on('blur', () => hotkeys('shift+;', onSearchKey))
    hotkeys('shift+;', onSearchKey)
    hotkeys('d', () => {
        // const isVisible = $("#sidebar")[0].classList.contains('visible')
        // if (isVisible)
        //     $('.sidebar').sidebar('toggle')
        $('.sidebar')
            .sidebar('setting', 'transition', 'overlay')
            .sidebar('toggle')
        window.gtag?.('event', 'details')
    })
    hotkeys('l', () => showLogs(selectedItem))
}

const initConnectionHandling = () => {

    socket.on('connect', async () => {
        $('#dimmer').removeClass('active')
        await checkDaemonVersion()

        // Re-execute the query
        if (window.history.state?.s)
            await doSearch(window.history.state.s, window.history.state.p, true, false)
   })

   socket.on('disconnect', async () => {
       $('#dimmer').addClass('active')
       await cleanupQuery()
   })
}

const jsonDblClick = async (e) => {
    $('.sidebar').sidebar('toggle')
    e.preventDefault()
    if (!e.target.parentElement) return

    const dataPath = e.target.parentElement?.getAttribute('data-path')
    if (!dataPath) return

    const stringVal = e.target.parentElement.querySelector('.string')?.textContent
    const numberVal = e.target.parentElement.querySelector('.number')?.textContent

    const val = cleanupValue(stringVal, numberVal)
    if (val)
        await doSearch(`${dataPath}:${val}`)
}

if (false && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered', reg))
        .catch((err) => console.log('Service Worker failed', err))

    navigator.serviceWorker.addEventListener('message', event => {
    // event is a MessageEvent object
        console.log(`The service worker sent me a message: ${JSON.stringify(event.data)}`)
    })

    navigator.serviceWorker.ready.then(registration => {
        registration.active.postMessage('get-token')
    })
}

$(async () => {
    console.log(`READY build ${gitSHA}`)
    await window.customElements.whenDefined('json-viewer')

    initFeathers()
    initWatches()
    initHotKeys()
    initHelp()
    initConnectionHandling()

    $(document).on('keydown', '#search-input', searchInputKeydown)
    $('#data-dump').html(renderHelpPage())
    $('#json')[0].shadowRoot.addEventListener('dblclick', jsonDblClick)

    $('#modals-placeholder').html(placeHelpModal())

    window.addEventListener('popstate', async (event) => await doSearch(event.state?.s, event.state?.p, true, false))

    const hidePopup = () => $('.copy-command').popup('hide')
    // copy the sticky HTML into the mobile-only part.
    // This needs to come before the copy-command events
    $('.mobile').html($('.sticky').html())
    $('.copy-command')
        .popup({
            on: 'click'
        })
        .click(() => {
            window.gtag?.('event', 'cta-install-copy')
            const install = 'curl -L https://get.c6o.io | /bin/bash && czctl start'
            navigator.clipboard.writeText(install)
            setTimeout(hidePopup, 3500)
        })

    const params = new URLSearchParams(document.location.search)
    const searchString = params.get('s')
    const parmPage = params.get('p')
    const storedLimit = params.get('l') || window.localStorage.getItem('kq-limit')
    if (storedLimit)
        limit = parseInt(storedLimit)
    groupBy = params.get('g') || window.localStorage.getItem('kq-group') || 'none'

    page = parmPage ? parseInt(parmPage) : 1
    if (searchString)
        await doSearch(searchString, page, true, false)
    else
        onSearchKey()
})