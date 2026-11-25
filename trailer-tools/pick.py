import json, subprocess, os, sys
E = {e['id']: e for e in json.load(open('episodes.json'))}
I = json.load(open('/home/user/Rory-s-rangers-/public/audio/voice/index.json'))
V = '/home/user/Rory-s-rangers-/public/audio/voice/'
# name: (episode, text prefix)
SEL = {
 'kl_relax': ('klerble_welcome', 'Most of all, we want Krelworld to relax'),
 'kl_armed': ('klerble_welcome', 'We are also the most heavily armed'),
 'kl_keep': ('klerble_welcome', 'Keep watching, Krelworld'),
 'kl_nothing': ('klerble_welcome', 'Er… I mean… nothing'),
 'n1_nine': ('news_1', 'The song, titled'),
 'n1_pigeon': ('news_1', 'In other news, a pigeon'),
 'n1_hello': ('news_1', "I'm being told"),
 'n2_cheese': ('news_2', 'The term was coined'),
 'n2_sport': ('news_2', 'Fascinating. Sport now'),
 'n3_purple': ('news_3', 'Threat level today'),
 'n4_ban': ('news_4', 'Good evening. Tonight: Flenky'),
 'n4_pls': ('news_4', 'Flenky Jenky has issued'),
 'n5_boats': ('news_5', 'Three different boats'),
 'cab_vote': ('cabinet_live', 'The Supreme Leader then voted'),
 'cab_fs': ('cabinet_live', 'Fuck sake'),
 'cab_def': ('cabinet_live', 'We have no defence'),
 'cab_distr': ('cabinet_live', 'I was distracted'),
 'sh_lines': ('shopping', 'Lines are open'),
 'sh_reach': ('shopping', 'That\'s right. The Wonking'),
 'kb_mug': ('krelbank_ad', 'You left a dirty mug'),
 'kb_we': ('krelbank_ad', 'We are Krelbank!'),
 'kb_expo': ('krelbank_ad', 'There\'s no money to pay you'),
 'tel_either': ('krews_telly', "You're watching it either way"),
 'mb_bag': ('krews_moneybags', 'Judge Krelmor! Judge Krelmor'),
 'mb_nc': ('krews_moneybags', 'No comment'),
 'mb_halluc': ('krews_moneybags', 'The video footage of the incident'),
 'un_sex': ('krews_universe', 'Some people are even able'),
 'un_back': ('krews_universe', 'Back to the studio'),
 'dk_health': ('drama_dickinson', 'Mr. Dickinson, your stance'),
 'dk_bargain': ('drama_dickinson', 'Bargain hunt!'),
 'dk_chips': ('drama_dickinson', 'Cheap as chips!'),
 'ktp_ask': ('krews_kill_the_patient', 'Asked to explain the difference'),
 'ktp_seq': ('krews_kill_the_patient', 'This is the sequel'),
 'cm_godric': ('creation_myth', '…fuck… I can'),
 'cm_hp': ('creation_myth', 'From Harry Potter'),
 'cm_two': ('creation_myth', 'Only two words'),
 'cm_wow': ('creation_myth', 'Big wowzer'),
 'mt_moles': ('drama_mole_of_thrones', 'For the first time in my life'),
 'zy_fart': ('drama_zero_years', 'Did you... did you just fart'),
 'zy_zero': ('drama_zero_years', "Honestly, you're all acting"),
 'ab_arse': ('krews_arsebrush', "It's time we faced"),
 'ab_research': ('krews_arsebrush', 'Research is ongoing'),
 'ko_twenty': ('krews_klopp_bribe', 'It is a crumpled twenty'),
 'ko_fifty': ('krews_klopp_bribe', "Should've made it a fifty"),
 'rr_fart': ('krews_roboref', 'It has also just farted'),
}
out = {}
for name, (ep, pre) in SEL.items():
    beats = E[ep]['beats']
    hits = [(i, b) for i, b in enumerate(beats) if b['type'] == 'speaker' and b['text'].startswith(pre)]
    if not hits: print('MISSING', name); continue
    i, b = hits[0]
    e = I.get(b['key'])
    if not e: print('NOREC', name); continue
    wav = f'lines/{name}.wav'
    if not os.path.exists(wav):
        data = open(V + e[0] + '.mp3', 'rb').read()[e[1]:e[1] + e[2]]
        open('/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/tvtrailer/lines/_t.mp3', 'wb').write(data)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'lines/_t.mp3', '-ar', '48000', '-ac', '2', wav], check=True)
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True).stdout)
    nsp = sum(1 for x in beats[:i] if x['type'] == 'speaker')
    out[name] = dict(ep=ep, beat=i, spk=nsp, key=b['key'], who=b['character'], text=b['text'], dur=round(d, 3))
    print(f"{name:12s} {ep:24s} b{i:3d} {d:5.2f}s {b['character']}: {b['text'][:80]}")
json.dump(out, open('picks.json', 'w'), indent=1)
