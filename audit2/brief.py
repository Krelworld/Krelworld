# Build one brief per worker from the architect+critic workflow result.
#   python3 brief.py <architect run id>  → final/<worker>.txt, final_plan.md, final.json
import json, sys, re, os
W = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/'
WF = '/root/.claude/projects/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/subagents/workflows/'
labels, res = {}, {}
for line in open(WF + sys.argv[1] + '/journal.jsonl'):
    j = json.loads(line)
    if j.get('type') == 'started': labels[j['key']] = j.get('label')
    if j.get('type') == 'result' and j.get('result'): res[labels.get(j['key'])] = j['result']
A, C = res['architect'], res.get('critic') or {'issues': [], 'worker_addenda': [], 'reassign': [], 'core_fixes': '', 'verdict': '?'}
items = {i['id']: i for i in A['items']}
for r in C.get('reassign', []):
    if r['id'] in items: items[r['id']]['worker'] = r['to']; items[r['id']]['reconcile'] += f"\n[critic moved this item from {r['from']} to {r['to']}: {r['why']}]"
draft = open(W + 'draft_plan.md').read(); verd = open(W + 'verdicts.md').read()
def section(text, head, gid):
    m = re.search(r'^' + head + ' ' + gid + r' .*?(?=^' + head + r' G\d+ |^# |\Z)', text, re.S | re.M)
    return m.group(0).strip() if m else '(not found)'
os.makedirs(W + 'final', exist_ok=True)
workers = {w['name']: w for w in A['workers']}
for r in C.get('reassign', []):
    for w in workers.values():
        if r['id'] in w['items'] and w['name'] != r['to']: w['items'].remove(r['id'])
    if r['to'] in workers and r['id'] not in workers[r['to']]['items']: workers[r['to']]['items'].append(r['id'])
out = {'workers': []}
for k, (name, w) in enumerate(workers.items()):
    ids = [i for i in w['items'] if items.get(i, {}).get('status', 'build') == 'build']
    deferred = [i for i in w['items'] if items.get(i, {}).get('status') == 'defer']
    conf = [c for c in A['conflicts'] if set(c['items']) & set(w['items'])]
    add = [a['note'] for a in C.get('worker_addenda', []) if a['worker'] in (name, 'all', '*', 'every worker')]
    iss = [i for i in C.get('issues', []) if not i.get('fixed') and (name in i['where'] or any(g in i['where'] for g in w['items']))]
    t = [f"# WORKER BRIEF: {name}  (overlay file: {w['file']})\nItems to build: {', '.join(ids)}" + (f"\nDeferred (do NOT build): {', '.join(deferred)}" if deferred else ''),
         f"\n## Your surface\n{w['surface']}\n\n## Local edits allowed\n{w['local_edits']}\n\n## Order notes\n{w.get('order_notes', '')}",
         f"\n## Shared core API (already built, in the game folder)\n{A['core_api']}\n\n## Load order\n{A['load_order']}\n\n## Conventions (must follow)\n{A['conventions']}",
         "\n## Critic addenda for you\n" + ('\n'.join('- ' + a for a in add) or '(none)'),
         "\n## Open critic issues touching your items\n" + ('\n'.join(f"- [{i['severity']}] {i['where']}: {i['problem']} → {i['fix']}" for i in iss) or '(none)'),
         "\n## Cross-item conflicts involving your items\n" + ('\n'.join(f"- {'/'.join(c['items'])}: {c['problem']} → {c['resolution']}" for c in conf) or '(none)')]
    for gid in ids:
        it = items[gid]
        t.append(f"\n\n==================== {gid} ====================\n### ARCHITECT'S RECONCILIATION (what to build)\n{it['reconcile']}\nDepends on: {', '.join(it.get('depends_on') or []) or '-'}\nInteractions: {it.get('interactions') or '-'}\n\n### DRAFT ITEM\n{section(draft, '###', gid)}\n\n### REVIEW VERDICTS (amendments supersede the draft; run every EXTRA CHECK)\n{section(verd, '##', gid)}")
    open(W + f'final/{name}.txt', 'w').write('\n'.join(t))
    out['workers'].append({'name': name, 'file': w['file'], 'items': ids, 'deferred': deferred, 'k': k, 'brief': W + f'final/{name}.txt', 'size': len('\n'.join(t))})
json.dump({'arch': A, 'crit': C, **out}, open(W + 'final.json', 'w'), indent=1)
md = [f"# Final build plan\nCritic verdict: {C.get('verdict')}\nCore fixes by critic: {C.get('core_fixes')}\n\n## Core API\n{A['core_api']}\n\n## Load order\n{A['load_order']}\n\n## Conventions\n{A['conventions']}\n\n## Core tests\n{A['core_tests']}\n"]
for w in out['workers']: md.append(f"- **{w['name']}** ({w['file']}): {', '.join(w['items'])}" + (f" — deferred {', '.join(w['deferred'])}" if w['deferred'] else '') + f" [{w['size']//1000} KB brief]")
md.append('\n## Conflicts\n' + '\n'.join(f"- {'/'.join(c['items'])}: {c['problem']} → {c['resolution']}" for c in A['conflicts']))
md.append('\n## Critic issues\n' + '\n'.join(f"- [{i['severity']}{' FIXED' if i['fixed'] else ''}] {i['where']}: {i['problem']} → {i['fix']}" for i in C.get('issues', [])))
open(W + 'final_plan.md', 'w').write('\n'.join(md))
for w in out['workers']: print(w['k'], w['name'], w['file'], w['items'], w['deferred'], w['size'])
