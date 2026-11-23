# Gather a phase's workflow results into the markdown files the next phase reads.
#   python3 collect.py findings <run ids…>   → findings.md + findings.json
#   python3 collect.py plans <run ids…>      → plans.md + plans.json
#   python3 collect.py judges <run ids…>     → judges.md + judges.json
#   python3 collect.py draft <run id>        → draft_plan.md + draft_plan.json
import json, sys
W = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/'
WF = '/root/.claude/projects/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/subagents/workflows/'
def results(run):
    labels = {}
    for line in open(WF + run + '/journal.jsonl'):
        j = json.loads(line)
        if j.get('type') == 'started': labels[j.get('key')] = j.get('label', '')
        if j.get('type') == 'result' and j.get('result') is not None: yield j.get('label') or labels.get(j.get('key'), ''), j['result']
mode, runs = sys.argv[1], sys.argv[2:]
if mode == 'findings':
    F = []
    for run in runs:
        for label, r in results(run):
            for f in (r.get('findings') or []): F.append({'lens': label.replace('critic:', ''), **f})
    F.sort(key=lambda f: -f.get('severity', 0))
    for i, f in enumerate(F): f['id'] = 'F%d' % (i + 1)
    json.dump(F, open(W + 'findings.json', 'w'), indent=1)
    md = ['# Findings from the critics (%d), most severe first\n' % len(F)]
    for f in F: md.append(f"## {f['id']} [{f['lens']}] sev{f['severity']} impact:{f['functionality_impact']} habit:{f['habit_cost']} effort:{f['effort']}{' BUG' if f.get('is_bug') else ''}\n**{f['title']}**\n- WHERE: {f['where']}\n- PROBLEM: {f['problem']}\n- EVIDENCE: {f['evidence']}\n- PROPOSAL: {f['proposal']}\n")
    open(W + 'findings.md', 'w').write('\n'.join(md)); print(len(F), 'findings;', sum(1 for f in F if f.get('is_bug')), 'bugs;', {s: sum(1 for f in F if f['severity'] == s) for s in range(5, 0, -1)})
elif mode == 'plans':
    P = []
    for run in runs:
        for label, r in results(run):
            if 'key' not in r: r['key'] = (r['items'][0]['id'].split('-')[0] if r.get('items') else 'plan')
            P.append(r)
    json.dump(P, open(W + 'plans.json', 'w'), indent=1)
    md = []
    for p in P:
        md.append(f"# PLAN \"{p['key']}\" — {p['philosophy']}\n{p['rationale']}\n")
        for i in p['items']: md.append(f"### {i['id']} [{i['group']}] {i['title']}\n- problem: {i['problem']}\n- change: {i['change']}\n- implementation: {i['implementation']}\n- must still work: {'; '.join(i['must_still_work'])}\n- benefit: {i['benefit']}\n- risk: {i['risk']}\n- answers: {', '.join(i.get('from_findings') or [])}\n")
        md.append('Left alone: ' + '; '.join(p['deliberately_left_alone']) + '\n')
    open(W + 'plans.md', 'w').write('\n'.join(md)); print(len(P), 'plans', [(p['key'], len(p['items'])) for p in P])
elif mode == 'judges':
    J = []
    for run in runs:
        for label, r in results(run):
            r.setdefault('judge', label.replace('judge:', '') or 'judge%d' % (len(J) + 1)); J.append(r)
    json.dump(J, open(W + 'judges.json', 'w'), indent=1)
    md = []
    for j in J: md.append(f"# Judge {j['judge']}\nScores: " + ' | '.join(f"{s['plan']}={s['score']} ({s['why']})" for s in j['scores']) + "\n\nMUST KEEP:\n" + '\n'.join('- ' + x for x in j['must_keep']) + "\n\nMUST DROP:\n" + '\n'.join('- ' + x for x in j['must_drop']) + "\n\nAMEND:\n" + '\n'.join('- ' + x for x in j['amendments']) + "\n\nMISSING:\n" + '\n'.join('- ' + x for x in j['missing']) + '\n')
    open(W + 'judges.md', 'w').write('\n'.join(md)); print(len(J), 'judges', [(j['judge'], [(s['plan'], s['score']) for s in j['scores']]) for j in J])
elif mode == 'draft':
    for label, r in results(runs[0]): D = r
    json.dump(D, open(W + 'draft_plan.json', 'w'), indent=1)
    md = ['# Draft plan\n' + D['summary'] + '\n']
    for g in ['bugs', 'hud', 'menus-icons', 'prompts', 'screens', 'wayfinding']:
        its = [i for i in D['items'] if i['group'] == g]
        if not its: continue
        md.append(f"\n# Group: {g}\n")
        for i in its: md.append(f"### {i['id']} {i['title']}\n- problem: {i['problem']}\n- change: {i['change']}\n- implementation: {i['implementation']}\n- must still work: {'; '.join(i['must_still_work'])}\n- benefit: {i['benefit']}\n- risk: {i['risk']}\n")
    md.append('\n# Rejected in synthesis\n' + '\n'.join('- ' + x for x in D['rejected']))
    open(W + 'draft_plan.md', 'w').write('\n'.join(md)); print(len(D['items']), 'items', {g: sum(1 for i in D['items'] if i['group'] == g) for g in ['bugs', 'hud', 'menus-icons', 'prompts', 'screens', 'wayfinding']})
elif mode == 'verdicts':
    D = json.load(open(W + 'draft_plan.json'))
    V = {}
    for run in runs:
        for label, r in results(run):
            for v in (r.get('verdicts') or []):
                lens = label.split(':')[-1]
                V.setdefault(v['id'], []).append({'lens': lens, **v})
    json.dump(V, open(W + 'verdicts.json', 'w'), indent=1)
    md = ['# Verdicts per draft item\n']
    tally = {}
    for i in D['items']:
        vs = V.get(i['id'], [])
        verdicts = [v['verdict'] for v in vs]
        overall = 'drop' if 'drop' in verdicts else ('amend' if 'amend' in verdicts else ('keep' if verdicts else 'MISSING'))
        tally[overall] = tally.get(overall, 0) + 1
        md.append(f"## {i['id']} [{i['group']}] {i['title']} => {overall.upper()} ({', '.join(v['lens'] + ':' + v['verdict'] for v in vs)})\n")
        for v in vs:
            md.append(f"**{v['lens']}: {v['verdict']}** — {v['reason']}\n")
            if v.get('amended_change'): md.append(f"- AMENDED CHANGE ({v['lens']}): {v['amended_change']}\n")
            if v.get('extra_checks'): md.append('- EXTRA CHECKS: ' + ' | '.join(v['extra_checks']) + '\n')
    open(W + 'verdicts.md', 'w').write('\n'.join(md)); print(tally, 'items with verdicts:', len(V))
