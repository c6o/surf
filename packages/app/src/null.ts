
const queries = [
    [
        'The basics',
    `
        <p>
        All queries are of the form:
            <strong>field:value</strong>
        </p>
        <p>
        You can search by any field across any resource type including array values.
        </p>
        <p>
        When searching inside arrays, simply treat the property like 
        any other property. If you are interested in:
            <strong>spec.containers[].name</strong>
        The predicate is simply:
            <strong>spec.containers.name:value</strong>
        </p>
    `
    ],
    ['Implied fields', 
    `
        Values without a <b>field:</b> prefix imply the <b>kind, metadata.name, and 
        metadata.namespace</b> properties. The string 
            <strong>foo</strong>
        is the same as
            <strong>(kind:foo || metadata.name:foo || metadata.namespace:foo)</strong>
    `],
    ['Field abbreviations', 
    `
        <p>
        The query <b>k:foo</b> is the same as
            <strong>kind:foo</strong>
        </p>
        <p>
        The query <b>ns:foo</b> is the same as
            <strong>metadata.namespace:foo</strong>
        </p>
        <p>
        The query <b>n:foo</b> is the same as
            <strong>metadata.name:foo</strong>
        </p>
        <p>
        So
            <strong>ns:foo && n:bar</strong>
        internally expands to
            <strong>metadata.namespace:foo && metadata.name:bar </strong>
        which really saves us a bunch of typing in the documentation as well!
        </p>

    `],
    ['Or based queries', 
    `
        <p>
        All <b>spaces</b> imply separate <b>or</b> predicates so:
            <strong>pod deploy</strong> 
        is the same as
            <strong>pod || deploy</strong>
        which internally expands to (deep breath):
            <strong>
            (kind:pod || metadata.namespace:pod || metadata.name:pod) ||
            (kind:deploy || metadata.namespace:deploy || metadata.name:deploy) 
            </strong>
        </p>
        <p>
        Be careful when attempting  to search strings such as <b>name:foo bar</b>.
        This would be interpreted as:
            <strong>n:foo || (k: bar || ns:bar || n:bar)</strong>
        Instead, use quotes like so:
            <strong>name:"foo bar"</strong>
        </p>
        which is not a legal Kubernetes resource name but you get the idea...
    `
    ],
    ['Use brackets to group predicates', 
    `
        <p>
        If you are interested in <b>pods</b> and <b>deployments</b> named <b>foo</b> and type:
            <strong>pod deploy n:foo</strong>
        you will end up finding all sorts of resources named  <b>foo</b> because
        the above query is in fact:
            <strong>
                (
                    (k:pod || n:pod || ns:pod) ||
                    (k:deploy || n:deploy || ns:deploy)
                ) <br/> 
                ||  <br/>
                (n:foo)
            </strong>
        </p>
        <p>
        Instead, you want (lazy version):
            <strong>(pod deploy) && foo</strong>
        which results in:
            <strong>
                (
                    (k:pod || n:pod || ns:pod) ||
                    (k:deploy || n:deploy || ns:deploy) 
                ) <br/>
                && <br/>
                (k:foo || n:foo || ns:foo)
            </strong>
        or the precise version:
            <strong>(k:pod k:deploy) && n:foo</strong>
        which results in:
        <strong>
            (
                k:pod ||
                k:deploy
            ) <br/>
            && <br/>
            (n:foo)
        </strong>
        But the lazy version is just about as fast!
        </p>
    `],
    ['Wildcards',
    `
        <p>
        The following:
            <strong>n:foo*</strong>
        will find all resources whose names <i>start</i> with <b>foo</b>
        </p>
        <p>
        You can use wildcards multiple times so:
            <strong>n:*foo*</strong>
        will find all resources whose names <i>contain</i> the string <b>foo</b>
        </p>
        <p>
        Finally, <b>*</b> get's expanded to:
            <strong>k:* || ns:* || n:*</strong>
        which will give you everything in the cluster. Thank goodness for paging!
        </p>
    `
    ]
]

const renderQuerySection = () =>  {
    let result = '<div class="ui large divided list">'
    for(const q of queries) {
        result += `
            <div class="item">
                <div class="help content">
                    <h3>${q[0]}</h3>
                    ${q[1]}
                </div>
            </div>
        `
    }
    result += '</div>'
    return result
}

export const renderHelpPage = (noResults = false) => `
    <div class="ui container">
        <h1>${noResults ? 'No results found' : 'Getting Started'}</h1>
        <div class="ui divider"></div>
        <div class="ui aligned padded grid">
            <div class="left aligned two column row">
                <div class="column">
                    <h2>Querying</h2>
                    ${renderQuerySection()}
                </div>
                <div class="column">
                    <h2>Shortcuts</h2>
                </div>
            </div>
        </div>
    </div>
`